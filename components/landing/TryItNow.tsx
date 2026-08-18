'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { AlertCircle, FileUp, Loader2, X } from 'lucide-react'
import { MAX_PDF_BYTES, humanBytes } from '@/lib/uploads'
import { savePendingImport } from '@/lib/pending-import'
import { trackProduct } from '@/lib/product-analytics'
import type { Book, Page } from '@/lib/book-schema'

// The reader pulls in react-pageflip and the whole viewer tree. It has no
// business in the landing page's initial bundle when most visitors never drop a
// file — and it can't render on the server anyway.
const ViewerChrome = dynamic(
  () => import('@/components/viewer/ViewerChrome').then((m) => m.ViewerChrome),
  { ssr: false }
)

/**
 * Drop a PDF, see it as an edition, sign up afterwards.
 *
 * Every route into this product used to pass through an email round-trip before
 * anything could be seen: land, click "Start for free", type an address, leave
 * for an inbox, come back, and only then find out what the thing does. That is
 * the largest single drop in the funnel and it sat in front of the moment that
 * sells — a PDF you recognise, turning into pages.
 *
 * Nothing here needs an account. The renderer already runs in the browser
 * (lib/pdf-renderer.ts), so the preview is genuinely the reader, showing
 * genuinely the visitor's document. Signing in is asked for at the point where
 * they want to keep it, which is the point at which they have a reason to.
 */

/** Enough to prove the point without making a 200-page document render in full. */
const PREVIEW_PAGES = 6

type Status = 'idle' | 'rendering' | 'ready' | 'error'

export function TryItNow() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  const [status, setStatus] = useState<Status>('idle')
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState('')
  const [book, setBook] = useState<Book | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)

  // Blob URLs outlive the component unless revoked, and a 50-page preview holds
  // real memory.
  const urlsRef = useRef<string[]>([])
  const revokeAll = useCallback(() => {
    urlsRef.current.forEach((url) => URL.revokeObjectURL(url))
    urlsRef.current = []
  }, [])
  useEffect(() => revokeAll, [revokeAll])

  const handleFile = useCallback(
    async (picked: File | null | undefined) => {
      if (!picked) return
      if (picked.type !== 'application/pdf' && !picked.name.toLowerCase().endsWith('.pdf')) {
        setStatus('error')
        setError('That file isn’t a PDF. Try a .pdf and we’ll turn it into an edition.')
        return
      }
      if (picked.size > MAX_PDF_BYTES) {
        setStatus('error')
        setError(
          `That PDF is ${humanBytes(picked.size)} — the limit is ${humanBytes(MAX_PDF_BYTES)}.`
        )
        return
      }

      revokeAll()
      setFile(picked)
      setError('')
      setStatus('rendering')
      setProgress({ current: 0, total: 0 })
      trackProduct('try_upload_started', {
        file_mb: Math.round((picked.size / 1024 / 1024) * 10) / 10,
      })

      try {
        // Imported here rather than at module scope. pdf.js sets up its worker
        // on import and reaches for DOMMatrix, which doesn't exist while the
        // landing page is being prerendered — a static import fails the build
        // outright. It also keeps ~1MB of PDF machinery out of the bundle for
        // the majority of visitors who never drop a file.
        const { renderPdfPages } = await import('@/lib/pdf-renderer')

        const rendered = await renderPdfPages(picked, {
          maxPages: PREVIEW_PAGES,
          // Half the import's scale. This is a preview on a screen, not the
          // asset that gets stored, and the render is the whole wait.
          scale: 1,
          onProgress: (p) => setProgress({ current: p.current, total: p.total }),
        })

        if (rendered.length === 0) throw new Error('We couldn’t read any pages from that PDF.')

        const pages: Page[] = rendered.map((page, i) => {
          const url = URL.createObjectURL(page.blob)
          urlsRef.current.push(url)
          return {
            id: `preview-${i}`,
            book_id: 'preview',
            page_number: i + 1,
            type: i === 0 ? 'cover' : 'content',
            layout: 'blank',
            background: { image: url },
            blocks: [],
            hotspots: [],
          }
        })

        setBook({
          id: 'preview',
          slug: 'preview',
          title: picked.name.replace(/\.pdf$/i, ''),
          owner_id: 'preview',
          theme: { preset: 'ivory' },
          settings: {
            published: true,
            unlisted: true,
            gating: {
              enabled: false,
              page_number: 3,
              type: 'email',
              title: 'Unlock the full version',
              description: 'Enter your email to continue reading.',
            },
            whitelabel: true,
          },
          pages,
        })
        setStatus('ready')
        trackProduct('try_preview_shown', { pages: rendered.length })
      } catch (err) {
        setStatus('error')
        const message = err instanceof Error ? err.message : 'We couldn’t open that PDF.'
        setError(message)
        trackProduct('try_failed', { reason: message.slice(0, 80) })
      }
    },
    [revokeAll]
  )

  const claim = useCallback(async () => {
    if (!file) return
    setSaving(true)
    trackProduct('try_claim_clicked')

    // Hand the file to the studio across the sign-in round trip. If the browser
    // won't store it, the sign-in still happens and the import dialog opens
    // empty — a re-upload, not a dead end.
    const stored = await savePendingImport(file)
    router.push(
      `/login?next=${encodeURIComponent(stored ? '/dashboard?resume=1' : '/dashboard?new=1')}`
    )
  }, [file, router])

  const reset = useCallback(() => {
    revokeAll()
    setBook(null)
    setFile(null)
    setStatus('idle')
    setError('')
  }, [revokeAll])

  if (status === 'ready' && book) {
    return (
      <section id="try" className="px-5 py-16">
        <div className="mx-auto max-w-4xl">
          <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-fg)]">
                Your document
              </p>
              <h2 className="font-display mt-1 text-3xl font-semibold tracking-[-0.03em]">
                {book.title}
              </h2>
              <p className="mt-1 text-sm text-[var(--qlico-muted)]">
                First {book.pages?.length} pages, live. Drag the page corners, or use the arrow
                keys.
              </p>
            </div>
            <button
              onClick={reset}
              className="flex items-center gap-1.5 rounded-full border border-[var(--qlico-border)] px-4 py-2 text-sm font-semibold transition-colors hover:bg-[var(--tint-weak)]"
            >
              <X size={14} />
              Try another
            </button>
          </div>

          <div className="overflow-hidden rounded-[1.5rem] border border-[var(--qlico-border)] bg-[var(--qlico-subtle)] p-4">
            <div className="h-[60vh] min-h-[420px]">
              <ViewerChrome book={book} showBadge={false} embed />
            </div>
          </div>

          <div className="mt-8 rounded-[1.5rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)] p-7 text-center">
            <h3 className="font-display text-2xl font-semibold tracking-[-0.03em]">
              Keep it, and find out who reads it.
            </h3>
            <p className="mx-auto mt-2 max-w-md text-[15px] leading-7 text-[var(--qlico-muted)]">
              Sign in and we&apos;ll import the whole document, give it a link you can send
              anywhere, and show you which pages people actually finish.
            </p>
            <button
              onClick={claim}
              disabled={saving}
              className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-7 py-3.5 text-[15px] font-semibold text-white transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              {saving ? 'One moment…' : 'Save this edition'}
            </button>
            <p className="mt-3 text-xs text-[var(--qlico-muted)]">
              Free for three editions. No card.
            </p>
          </div>
        </div>
      </section>
    )
  }

  return (
    <section id="try" className="px-5 py-16">
      <div className="mx-auto max-w-2xl text-center">
        <h2 className="font-display text-3xl font-semibold tracking-[-0.02em] sm:text-4xl">
          Try it with your own PDF.
        </h2>
        <p className="mx-auto mt-3 max-w-lg text-[15px] leading-7 text-[var(--qlico-muted)]">
          It renders in your browser — nothing is uploaded, and there&apos;s nothing to sign up for
          until you want to keep it.
        </p>

        <div
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            handleFile(e.dataTransfer.files?.[0])
          }}
          className={`mt-8 rounded-[1.5rem] border-2 border-dashed p-10 transition-colors ${
            dragging
              ? 'border-[var(--accent)] bg-[var(--accent)]/5'
              : 'border-[var(--qlico-border)] bg-[var(--qlico-paper)]'
          }`}
        >
          <input
            ref={inputRef}
            type="file"
            accept=".pdf,application/pdf"
            className="sr-only"
            onChange={(e) => handleFile(e.target.files?.[0])}
          />

          {status === 'rendering' ? (
            <div className="flex flex-col items-center gap-3">
              <Loader2 size={22} className="animate-spin text-[var(--accent-fg)]" />
              <p className="text-sm font-medium">
                {progress.total > 0
                  ? `Turning page ${progress.current} of ${progress.total}…`
                  : 'Opening your PDF…'}
              </p>
            </div>
          ) : (
            <>
              <FileUp size={26} className="mx-auto mb-3 text-[var(--qlico-muted)]" />
              <button
                onClick={() => inputRef.current?.click()}
                className="rounded-full bg-[var(--accent)] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[var(--accent-hover)]"
              >
                Choose a PDF
              </button>
              <p className="mt-3 text-xs text-[var(--qlico-muted)]">
                …or drop one here. Up to {humanBytes(MAX_PDF_BYTES)}.
              </p>
            </>
          )}

          {status === 'error' && error && (
            <p
              role="alert"
              className="mx-auto mt-5 flex max-w-sm items-start gap-2 rounded-xl bg-red-50 p-3 text-left text-sm text-red-700"
            >
              <AlertCircle size={16} className="mt-0.5 shrink-0" />
              {error}
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
