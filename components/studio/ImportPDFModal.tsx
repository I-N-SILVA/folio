'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { X, FileUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { renderPdfPages, type RenderProgress } from '@/lib/pdf-renderer'
import { MAX_PDF_BYTES, humanBytes } from '@/lib/uploads'
import { createBrowserSupabase } from '@/lib/supabase'
import { MAX_IMPORT_PAGES, mapWithConcurrency } from '@/lib/import'

interface ImportPDFModalProps {
  onClose: () => void
  /** Lets the parent swap in its upgrade wall when the plan quota is hit. */
  onLimitReached?: () => void
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

type Status = 'idle' | 'rendering' | 'uploading' | 'finishing' | 'done' | 'error'

/** Parallel page uploads. Enough to saturate a connection, few enough to be fair. */
const UPLOAD_CONCURRENCY = 4

export function ImportPDFModal({ onClose, onLimitReached }: ImportPDFModalProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [aiEnhance, setAiEnhance] = useState(true) // Default to true for "Elite" experience
  // null while we're still asking. AI is optional at deploy time — without a
  // Gemini key the checkbox promised hotspot detection and SEO tags the install
  // cannot produce, and every page of the import made a doomed API call.
  const [aiAvailable, setAiAvailable] = useState<boolean | null>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<RenderProgress>({
    current: 0,
    total: 0,
    phase: 'loading',
  })
  const [errorMessage, setErrorMessage] = useState('')
  // Pages written to storage so far, so the upload phase reports real progress
  // instead of jumping to 100% and sitting there.
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

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0] ?? null
      setFile(picked)
      setErrorMessage('')
      if (picked && !title) {
        const derived = picked.name.replace(/\.pdf$/i, '')
        setTitle(derived)
        if (!slugEdited) {
          setSlug(slugify(derived))
        }
      }
    },
    [title, slugEdited]
  )

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value)
      if (!slugEdited) {
        setSlug(slugify(e.target.value))
      }
    },
    [slugEdited]
  )

  const handleSlugChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugEdited(true)
    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const dropped = e.dataTransfer.files?.[0]
      if (
        dropped?.type === 'application/pdf' ||
        dropped?.name.toLowerCase().endsWith('.pdf')
      ) {
        setFile(dropped)
        setErrorMessage('')
        if (!title) {
          const derived = dropped.name.replace(/\.pdf$/i, '')
          setTitle(derived)
          if (!slugEdited) {
            setSlug(slugify(derived))
          }
        }
      }
    },
    [title, slugEdited]
  )

  const handleSubmit = useCallback(async () => {
    if (!file || !title.trim() || !slug.trim()) return

    // The book row is now created before the uploads, so the slug is claimed
    // early — which means a failure partway through would strand an empty book
    // holding that slug and a slot against the plan quota. Tracked here so the
    // error path can take it back out.
    let createdBookId: string | null = null

    try {
      // ── Phase 1: Render PDF pages client-side ─────────────────────────
      setStatus('rendering')
      setErrorMessage('')

      // The server no longer receives the PDF, so the size ceiling is checked
      // here — before spending time rendering a document that's too big.
      if (file.size > MAX_PDF_BYTES) {
        throw new Error(
          `That PDF is ${humanBytes(file.size)} — the limit is ${humanBytes(MAX_PDF_BYTES)}.`
        )
      }

      const renderedPages = await renderPdfPages(file, {
        maxPages: MAX_IMPORT_PAGES,
        scale: 2,
        onProgress: setProgress,
      })

      if (renderedPages.length === 0) {
        throw new Error('That PDF has no pages we could render.')
      }

      // ── Phase 2: Claim the book and get one signed target per page ─────
      const beginRes = await fetch('/api/import/pdf', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          slug: slug.trim(),
          pageCount: renderedPages.length,
        }),
      })

      const begin = await beginRes.json()

      if (!beginRes.ok) {
        // Hand the quota case to the parent, which owns the upgrade wall.
        if (begin.code === 'plan_limit' && onLimitReached) {
          onLimitReached()
          return
        }
        throw new Error(begin.error ?? 'Import failed')
      }

      createdBookId = begin.bookId as string

      // ── Phase 3: Write the pages straight to storage ───────────────────
      // These used to go up as one multipart body, which meant any real
      // document exceeded the platform's request-body cap and the import
      // refused to start. Going direct removes that ceiling entirely, and
      // uploading page by page means the progress bar reflects actual work.
      setStatus('uploading')
      setUploaded(0)
      setUploadTotal(renderedPages.length)

      const supabase = createBrowserSupabase()
      const targets = begin.uploads as { pageNumber: number; path: string; token: string }[]

      const failures = await mapWithConcurrency(targets, UPLOAD_CONCURRENCY, async (target) => {
        const page = renderedPages[target.pageNumber - 1]
        if (!page) return target.pageNumber

        const { error } = await supabase.storage
          .from('folio-assets')
          .uploadToSignedUrl(target.path, target.token, page.blob, {
            contentType: 'image/png',
          })

        setUploaded((n) => n + 1)
        return error ? target.pageNumber : null
      })

      const failed = failures.filter((n): n is number => n !== null)
      if (failed.length === targets.length) {
        throw new Error('None of the pages could be uploaded. Check your connection and retry.')
      }

      // ── Phase 4: Turn what landed into a book ──────────────────────────
      setStatus('finishing')

      const finishRes = await fetch('/api/import/pdf/finalize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          bookId: begin.bookId,
          aiEnhance: aiEnhance && aiAvailable !== false,
        }),
      })

      const data = await finishRes.json()
      if (!finishRes.ok) throw new Error(data.error ?? 'Import failed')

      // Past this point the book is real, so the error path must not remove it.
      createdBookId = null
      setStatus('done')
      if (failed.length > 0) {
        // Partial success is still success — say what's missing rather than
        // letting the author discover a short book later.
        toast.warning(
          `"${title}" imported with ${data.pageCount} of ${renderedPages.length} pages. ` +
            `${failed.length} failed to upload.`
        )
      } else {
        toast.success(`"${title}" imported — ${data.pageCount} pages ready.`)
      }

      // Brief delay so user sees the success state
      setTimeout(() => {
        onClose()
        router.push(`/editor/${data.bookId}`)
      }, 800)
    } catch (err) {
      // Give the slug and the quota slot back, so retrying with the same slug
      // doesn't collide with the wreckage of the attempt that just failed.
      if (createdBookId) {
        await fetch(`/api/books/${createdBookId}`, { method: 'DELETE' }).catch(() => {})
      }
      setStatus('error')
      const msg = (err as Error).message
      setErrorMessage(msg)
      toast.error(msg)
    }
  }, [file, title, slug, aiEnhance, aiAvailable, router, onClose, onLimitReached])

  const isWorking = status === 'rendering' || status === 'uploading' || status === 'finishing'
  const canSubmit =
    !!file && title.trim().length > 0 && slug.trim().length > 0 && !isWorking && status !== 'done'

  // Rendering and uploading are each roughly half the wait, so the bar tracks
  // them as two halves rather than snapping to 100% the moment rendering ends.
  const pct =
    status === 'rendering'
      ? progress.total > 0 ? Math.round((progress.current / progress.total) * 50) : 0
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

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60"
          onClick={isWorking || status === 'done' ? undefined : onClose}
        />

        {/* Dialog */}
        <motion.div
          className="relative bg-[var(--qlico-paper)] rounded-2xl shadow-2xl w-full max-w-md p-6"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ type: 'spring', duration: 0.3 }}
          role="dialog"
          aria-modal="true"
          aria-label="Import PDF"
        >
          {/* Close */}
          {!isWorking && status !== 'done' && (
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}

          <h2 className="text-lg font-bold mb-1">Import PDF</h2>
          <p className="text-sm text-gray-500 mb-5">
            Each page will be rendered as a high-quality image and added to a new book.
          </p>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 mb-5 text-center transition-colors ${
              isWorking
                ? 'border-gray-200 bg-gray-50 cursor-default'
                : file
                  ? 'border-[var(--accent)] bg-[var(--accent)]/5 cursor-pointer'
                  : 'border-gray-200 hover:border-gray-300 bg-gray-50 cursor-pointer'
            }`}
            onClick={() => !isWorking && status !== 'done' && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={isWorking || status === 'done'}
            />
            <FileUp
              size={24}
              className={`mx-auto mb-2 ${file ? 'text-[var(--accent-fg)]' : 'text-gray-400'}`}
            />
            {file ? (
              <div>
                <p className="text-sm font-medium text-[var(--accent-fg)] truncate px-2">{file.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                  {!isWorking && status !== 'done' && ' — click to change'}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 font-medium">
                  Drop a PDF here or click to browse
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Max 50 pages will be imported</p>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="My Book Title"
              disabled={isWorking || status === 'done'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[var(--accent)]/30 focus:border-[var(--accent)] disabled:opacity-50 transition"
            />
          </div>

          {/* Slug */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              URL Slug
            </label>
            <div className="flex items-center border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-[var(--accent)]/30 focus-within:border-[var(--accent)] transition">
              <span className="pl-3 text-xs text-gray-400 select-none whitespace-nowrap">
                /book/
              </span>
              <input
                type="text"
                value={slug}
                onChange={handleSlugChange}
                placeholder="my-book-title"
                disabled={isWorking || status === 'done'}
                className="flex-1 py-2 pr-3 text-sm bg-transparent focus:outline-none disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          {/* AI Enhancement — only offered when the deployment can actually do it */}
          <div
            className={`mb-6 p-4 rounded-xl border ${
              aiAvailable === false
                ? 'bg-gray-50 border-gray-200'
                : 'bg-[var(--accent)]/5 border-[var(--accent)]/10'
            }`}
          >
            <label
              className={`flex items-start gap-3 group ${
                aiAvailable === false ? 'cursor-default' : 'cursor-pointer'
              }`}
            >
              <div className="flex items-center h-5">
                <input
                  type="checkbox"
                  checked={aiEnhance && aiAvailable !== false}
                  onChange={(e) => setAiEnhance(e.target.checked)}
                  disabled={isWorking || status === 'done' || aiAvailable === false}
                  className="w-4 h-4 text-[var(--accent-fg)] border-gray-300 rounded focus:ring-[var(--accent)]/30"
                />
              </div>
              <div className="flex flex-col">
                <span
                  className={`text-sm font-bold transition-colors ${
                    aiAvailable === false
                      ? 'text-gray-400'
                      : 'text-gray-900 group-hover:text-[var(--accent-fg)]'
                  }`}
                >
                  Magic AI Enhancement
                </span>
                <span className="text-xs text-gray-500 leading-relaxed mt-0.5">
                  {aiAvailable === false
                    ? 'Unavailable — no AI key is configured for this deployment. Pages will import without hotspots or SEO tags.'
                    : 'Automatically detect products, hotspots, and generate SEO tags.'}
                </span>
              </div>
            </label>
          </div>

          {/* Progress bar */}
          {isWorking && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 size={14} className="animate-spin text-[var(--accent-fg)] flex-shrink-0" />
                  <span>{phaseLabel}</span>
                </div>
                <span className="text-xs text-gray-400 font-mono">{pct}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[var(--accent)] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}

          {/* Success state */}
          {status === 'done' && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 mb-5">
              <CheckCircle2 size={16} />
              <span className="font-medium">Import complete — redirecting to editor…</span>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && errorMessage && (
            <div className="flex items-start gap-2 text-sm text-red-600 mb-5 bg-red-50 p-3 rounded-lg">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={isWorking || status === 'done' ? undefined : onClose}
              disabled={isWorking || status === 'done'}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-lg bg-[var(--accent)] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isWorking ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {status === 'rendering'
                    ? 'Rendering…'
                    : status === 'uploading'
                      ? 'Uploading…'
                      : 'Finishing…'}
                </>
              ) : status === 'error' ? (
                <>
                  <FileUp size={14} />
                  Retry
                </>
              ) : (
                <>
                  <FileUp size={14} />
                  Import
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
