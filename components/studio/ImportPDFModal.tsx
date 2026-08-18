'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { motion } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { FileUp, Loader2, CheckCircle2, AlertCircle, ChevronDown } from 'lucide-react'
import { toast } from 'sonner'
import { renderPdfPages, type RenderProgress } from '@/lib/pdf-renderer'
import { MAX_PDF_BYTES, humanBytes } from '@/lib/uploads'
import { createBrowserSupabase } from '@/lib/supabase'
import { MAX_IMPORT_PAGES, mapWithConcurrency } from '@/lib/import'
import { Modal } from '@/components/ui/Modal'
import { trackProduct } from '@/lib/product-analytics'

interface ImportPDFModalProps {
  onClose: () => void
  /** Lets the parent swap in its upgrade wall when the plan quota is hit. */
  onLimitReached?: () => void
  /** A file handed over from elsewhere — e.g. a PDF dropped on the landing page. */
  initialFile?: File | null
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
}

/** Title from a filename: drop the extension, and the separators people use in them. */
function titleFromFile(name: string) {
  return name.replace(/\.pdf$/i, '').replace(/[_-]+/g, ' ').trim() || 'Untitled edition'
}

/** A slug collision has to resolve without sending the author back to a form. */
function randomSuffix() {
  return Math.random().toString(36).slice(2, 6).padEnd(4, '0')
}

type Status = 'idle' | 'rendering' | 'uploading' | 'finishing' | 'done' | 'error'

/** Parallel page uploads. Enough to saturate a connection, few enough to be fair. */
const UPLOAD_CONCURRENCY = 4

/**
 * Render scale, chosen from what the device can actually take.
 *
 * Rendering fifty pages of A4 at scale 2 allocates a canvas of roughly 1700 ×
 * 2400 per page. On a laptop that is fine; on a mid-range phone it is how a tab
 * gets killed halfway through an import, and the reader still gets a
 * screen-resolution image at the end. `deviceMemory` is Chromium-only, so the
 * viewport width carries the rest — a phone is a phone whatever it reports.
 */
function renderScale(): number {
  if (typeof window === 'undefined') return 2
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  if (typeof memory === 'number' && memory <= 4) return 1.5
  return window.innerWidth < 768 ? 1.5 : 2
}

/**
 * PDF import.
 *
 * Two things changed here beyond the styling. The dialog is built on the shared
 * `Modal` primitive rather than a hand-rolled portal, so it has the focus trap
 * every other dialog in the app has — it previously let keyboard focus wander
 * onto the page behind during an import that can run for minutes. And it no
 * longer asks for a title and a "URL Slug" before it will start: both are
 * derived from the filename, and the link is editable behind a disclosure for
 * the minority who care. The author came to see their document, not to name a
 * URL, and that form sat directly across the shortest path to the product's
 * first genuinely useful moment.
 */
export function ImportPDFModal({ onClose, onLimitReached, initialFile }: ImportPDFModalProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(initialFile ?? null)
  const [title, setTitle] = useState(initialFile ? titleFromFile(initialFile.name) : '')
  const [slug, setSlug] = useState(initialFile ? slugify(titleFromFile(initialFile.name)) : '')
  const [slugEdited, setSlugEdited] = useState(false)
  const [showLink, setShowLink] = useState(false)
  const [aiEnhance, setAiEnhance] = useState(true)
  // null while we're still asking. AI is optional at deploy time — without a
  // Gemini key the checkbox promised hotspot detection and SEO tags the install
  // cannot produce, and every page of the import made a doomed API call.
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<RenderProgress>({ current: 0, total: 0, phase: 'loading' })
  const [errorMessage, setErrorMessage] = useState('')
  const [uploaded, setUploaded] = useState(0)
  const [uploadTotal, setUploadTotal] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/entitlements', { signal: controller.signal })
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data) setAiAvailable(Boolean(data.ai?.enabled))
      })
      // A failed probe shouldn't block the import — leave it unknown and let the
      // server decide, which it does regardless of what we send.
      .catch(() => {})
    return () => controller.abort()
  }, [])

  const adopt = useCallback(
    (picked: File | null) => {
      if (!picked) return
      setFile(picked)
      setErrorMessage('')
      const derived = titleFromFile(picked.name)
      setTitle(derived)
      if (!slugEdited) setSlug(slugify(derived))
    },
    [slugEdited]
  )

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const dropped = e.dataTransfer.files?.[0]
      if (dropped?.type === 'application/pdf' || dropped?.name.toLowerCase().endsWith('.pdf')) {
        adopt(dropped)
      }
    },
    [adopt]
  )

  const handleSubmit = useCallback(async () => {
    if (!file) return

    const effectiveTitle = title.trim() || titleFromFile(file.name)
    let effectiveSlug = slug.trim() || slugify(effectiveTitle) || `edition-${randomSuffix()}`

    // The book row is created before the uploads so the slug is claimed early,
    // which means a failure partway through would strand an empty book holding
    // that slug and a slot against the plan quota. Tracked so the error path can
    // take it back out.
    let createdBookId: string | null = null

    try {
      setStatus('rendering')
      setErrorMessage('')

      // The server no longer receives the PDF, so the size ceiling is checked
      // here — before spending time rendering a document that's too big.
      if (file.size > MAX_PDF_BYTES) {
        throw new Error(`That PDF is ${humanBytes(file.size)} — the limit is ${humanBytes(MAX_PDF_BYTES)}.`)
      }

      trackProduct('import_started', {
        file_mb: Math.round((file.size / 1024 / 1024) * 10) / 10,
        ai: aiEnhance && aiAvailable !== false,
      })

      const renderedPages = await renderPdfPages(file, {
        maxPages: MAX_IMPORT_PAGES,
        scale: renderScale(),
        onProgress: setProgress,
      })

      if (renderedPages.length === 0) {
        throw new Error('That PDF has no pages we could render.')
      }

      // ── Claim the book and get one signed target per page ──────────────
      // A taken slug used to come back as a form error the author had to read,
      // understand and resolve. They didn't choose this slug — we derived it —
      // so resolving it is our job: retry once with a suffix.
      let begin: { bookId: string; slug: string; uploads: { pageNumber: number; path: string; token: string }[] } | null =
        null

      for (let attempt = 0; attempt < 2 && !begin; attempt++) {
        const beginRes = await fetch('/api/import/pdf', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: effectiveTitle,
            slug: effectiveSlug,
            pageCount: renderedPages.length,
          }),
        })
        const payload = await beginRes.json()

        if (beginRes.ok) {
          begin = payload
          break
        }
        if (payload.code === 'plan_limit') {
          trackProduct('import_failed', { phase: 'claim', reason: 'plan_limit' })
          if (onLimitReached) {
            onLimitReached()
            return
          }
          throw new Error(payload.error ?? 'Import failed')
        }
        if (beginRes.status === 409 && attempt === 0 && !slugEdited) {
          effectiveSlug = `${effectiveSlug}-${randomSuffix()}`.slice(0, 100)
          continue
        }
        throw new Error(payload.error ?? 'Import failed')
      }

      if (!begin) throw new Error('Could not start the import. Please try again.')
      createdBookId = begin.bookId

      // ── Write the pages straight to storage ────────────────────────────
      setStatus('uploading')
      setUploaded(0)
      setUploadTotal(renderedPages.length)

      const supabase = createBrowserSupabase()
      const targets = begin.uploads

      const failures = await mapWithConcurrency(targets, UPLOAD_CONCURRENCY, async (target) => {
        const page = renderedPages[target.pageNumber - 1]
        if (!page) return target.pageNumber

        const { error } = await supabase.storage
          .from('folio-assets')
          .uploadToSignedUrl(target.path, target.token, page.blob, { contentType: 'image/png' })

        setUploaded((n) => n + 1)
        return error ? target.pageNumber : null
      })

      const failed = failures.filter((n): n is number => n !== null)
      if (failed.length === targets.length) {
        throw new Error('None of the pages could be uploaded. Check your connection and retry.')
      }

      // ── Turn what landed into a book ───────────────────────────────────
      setStatus('finishing')

      const finishRes = await fetch('/api/import/pdf/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ bookId: begin.bookId, aiEnhance: aiEnhance && aiAvailable !== false }),
      })

      const data = await finishRes.json()
      if (!finishRes.ok) throw new Error(data.error ?? 'Import failed')

      // Past this point the book is real, so the error path must not remove it.
      createdBookId = null
      setStatus('done')
      trackProduct('import_completed', {
        pages_landed: data.pageCount ?? 0,
        pages_failed: failed.length,
      })

      if (failed.length > 0) {
        // Partial success is still success — say what's missing rather than
        // letting the author discover a short edition later.
        toast.warning(
          `"${effectiveTitle}" imported with ${data.pageCount} of ${renderedPages.length} pages. ` +
            `${failed.length} failed to upload.`
        )
      } else {
        toast.success(`"${effectiveTitle}" imported — ${data.pageCount} pages ready.`)
      }

      setTimeout(() => {
        onClose()
        router.push(`/editor/${data.bookId}`)
      }, 800)
    } catch (err) {
      // Give the slug and the quota slot back, so retrying doesn't collide with
      // the wreckage of the attempt that just failed.
      if (createdBookId) {
        await fetch(`/api/books/${createdBookId}`, { method: 'DELETE' }).catch(() => {})
      }
      setStatus('error')
      const msg = (err as Error).message
      setErrorMessage(msg)
      trackProduct('import_failed', { phase: status, reason: msg.slice(0, 80) })
      toast.error(msg)
    }
  }, [file, title, slug, slugEdited, aiEnhance, aiAvailable, router, onClose, onLimitReached, status])

  const isWorking = status === 'rendering' || status === 'uploading' || status === 'finishing'
  const canSubmit = !!file && !isWorking && status !== 'done'

  // Rendering and uploading are each roughly half the wait, so the bar tracks
  // them as two halves rather than snapping to 100% the moment rendering ends.
  const pct =
    status === 'rendering'
      ? progress.total > 0
        ? Math.round((progress.current / progress.total) * 50)
        : 0
      : status === 'uploading'
        ? 50 + (uploadTotal > 0 ? Math.round((uploaded / uploadTotal) * 50) : 0)
        : status === 'finishing'
          ? 100
          : 0

  const phaseLabel =
    status === 'rendering'
      ? `Rendering page ${progress.current} of ${progress.total}…`
      : status === 'uploading'
        ? `Uploading page ${Math.min(uploaded + 1, uploadTotal)} of ${uploadTotal}…`
        : 'Finishing up…'

  return (
    <Modal
      onClose={isWorking || status === 'done' ? () => {} : onClose}
      title="Import a PDF"
      dismissOnBackdrop={!isWorking && status !== 'done'}
      hideCloseButton={isWorking || status === 'done'}
      className="max-w-md rounded-2xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)] p-6 text-[var(--qlico-ink)]"
    >
      <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">Import a PDF</h2>
      <p className="mt-1 text-sm text-[var(--qlico-muted)]">
        Every page becomes a spread you can add hotspots, links and media to.
      </p>

      {/* Drop zone */}
      <div
        onClick={() => !isWorking && status !== 'done' && fileInputRef.current?.click()}
        onDrop={handleDrop}
        onDragOver={(e) => e.preventDefault()}
        className={`mt-5 rounded-xl border-2 border-dashed p-6 text-center transition-colors ${
          isWorking
            ? 'cursor-default border-[var(--qlico-border)] bg-[var(--qlico-subtle)]'
            : file
              ? 'cursor-pointer border-[var(--accent)] bg-[var(--accent)]/5'
              : 'cursor-pointer border-[var(--qlico-border)] bg-[var(--qlico-subtle)] hover:border-[var(--accent)]'
        }`}
      >
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="hidden"
          onChange={(e) => adopt(e.target.files?.[0] ?? null)}
          disabled={isWorking || status === 'done'}
        />
        <FileUp
          size={24}
          className={`mx-auto mb-2 ${file ? 'text-[var(--accent-fg)]' : 'text-[var(--qlico-muted)]'}`}
        />
        {file ? (
          <div>
            <p className="truncate px-2 text-sm font-semibold text-[var(--accent-fg)]">{file.name}</p>
            <p className="mt-0.5 text-xs text-[var(--qlico-muted)]">
              {(file.size / 1024 / 1024).toFixed(1)} MB
              {!isWorking && status !== 'done' && ' — click to change'}
            </p>
          </div>
        ) : (
          <div>
            <p className="text-sm font-medium">Drop a PDF here, or click to choose one</p>
            <p className="mt-0.5 text-xs text-[var(--qlico-muted)]">
              Up to {MAX_IMPORT_PAGES} pages, {humanBytes(MAX_PDF_BYTES)}
            </p>
          </div>
        )}
      </div>

      {/* The title and the link are derived from the filename. Both are editable,
          behind a disclosure, because neither is a decision worth stopping for —
          the title is renameable in the editor and a taken link resolves itself. */}
      {file && !isWorking && status !== 'done' && (
        <div className="mt-4">
          <button
            type="button"
            onClick={() => setShowLink((v) => !v)}
            aria-expanded={showLink}
            className="flex w-full items-center justify-between gap-2 rounded-lg px-1 py-1.5 text-left text-xs text-[var(--qlico-muted)] transition-colors hover:text-[var(--qlico-ink)]"
          >
            <span>
              Publishing as <strong className="font-semibold text-[var(--qlico-ink)]">{title}</strong> at
              /book/{slug || slugify(title)}
            </span>
            <ChevronDown size={14} className={`shrink-0 transition-transform ${showLink ? 'rotate-180' : ''}`} />
          </button>

          {showLink && (
            <div className="mt-2 space-y-3 rounded-xl border border-[var(--qlico-border)] bg-[var(--qlico-subtle)] p-3">
              <div>
                <label htmlFor="import-title" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--qlico-muted)]">
                  Title
                </label>
                <input
                  id="import-title"
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value)
                    if (!slugEdited) setSlug(slugify(e.target.value))
                  }}
                  className="w-full rounded-lg border border-[var(--qlico-border)] bg-[var(--qlico-paper)] px-3 py-2 text-sm outline-none focus:border-[var(--accent)]"
                />
              </div>
              <div>
                <label htmlFor="import-slug" className="mb-1 block text-[11px] font-semibold uppercase tracking-[0.1em] text-[var(--qlico-muted)]">
                  Link
                </label>
                <div className="flex items-center overflow-hidden rounded-lg border border-[var(--qlico-border)] bg-[var(--qlico-paper)] focus-within:border-[var(--accent)]">
                  <span className="border-r border-[var(--qlico-border)] bg-[var(--qlico-subtle)] px-2.5 py-2 text-xs text-[var(--qlico-muted)]">
                    /book/
                  </span>
                  <input
                    id="import-slug"
                    value={slug}
                    onChange={(e) => {
                      setSlugEdited(true)
                      setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
                    }}
                    className="flex-1 bg-transparent px-2.5 py-2 text-sm outline-none"
                  />
                </div>
                <p className="mt-1 text-[11px] text-[var(--qlico-muted)]">
                  This is the public address, and it can&apos;t be changed later.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Only offered when the deployment can actually do it. */}
      {aiAvailable !== false && !isWorking && status !== 'done' && (
        <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-xl border border-[var(--accent)]/15 bg-[var(--accent)]/5 p-3">
          <input
            type="checkbox"
            checked={aiEnhance}
            onChange={(e) => setAiEnhance(e.target.checked)}
            className="mt-0.5 h-4 w-4 rounded border-[var(--qlico-border)]"
          />
          <span className="text-sm">
            <span className="font-semibold">Find products and write page descriptions</span>
            <span className="mt-0.5 block text-xs leading-5 text-[var(--qlico-muted)]">
              Scans each page for things worth tagging and drafts the search description for you.
            </span>
          </span>
        </label>
      )}

      {/* Progress */}
      {isWorking && (
        <div className="mt-5">
          <div className="mb-2 flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm text-[var(--qlico-muted)]">
              <Loader2 size={14} className="shrink-0 animate-spin text-[var(--accent-fg)]" />
              {phaseLabel}
            </span>
            <span className="font-mono text-xs text-[var(--qlico-muted)] tabular-nums">{pct}%</span>
          </div>
          <div
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Import progress"
            className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--tint)]"
          >
            <motion.div
              className="h-full rounded-full bg-[var(--accent)]"
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
        </div>
      )}

      {status === 'done' && (
        <p className="mt-5 flex items-center gap-2 text-sm font-medium text-emerald-600">
          <CheckCircle2 size={16} />
          Imported — opening the editor…
        </p>
      )}

      {status === 'error' && errorMessage && (
        <p role="alert" className="mt-5 flex items-start gap-2 rounded-lg bg-red-50 p-3 text-sm text-red-700">
          <AlertCircle size={16} className="mt-0.5 shrink-0" />
          {errorMessage}
        </p>
      )}

      <div className="mt-6 flex items-center gap-3">
        <button
          onClick={isWorking || status === 'done' ? undefined : onClose}
          disabled={isWorking || status === 'done'}
          className="flex-1 rounded-full border border-[var(--qlico-border)] py-2.5 text-sm font-medium text-[var(--qlico-muted)] transition-colors hover:bg-[var(--tint-weak)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          Cancel
        </button>
        <button
          onClick={handleSubmit}
          disabled={!canSubmit}
          className="flex flex-[2] items-center justify-center gap-2 rounded-full bg-[var(--accent)] py-2.5 text-sm font-semibold text-white transition-colors hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-40"
        >
          {isWorking ? (
            <>
              <Loader2 size={14} className="animate-spin" />
              {status === 'rendering' ? 'Rendering…' : status === 'uploading' ? 'Uploading…' : 'Finishing…'}
            </>
          ) : status === 'error' ? (
            <>
              <FileUp size={14} />
              Try again
            </>
          ) : (
            <>
              <FileUp size={14} />
              Import
            </>
          )}
        </button>
      </div>
    </Modal>
  )
}
