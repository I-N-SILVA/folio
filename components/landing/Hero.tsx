'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { m, useReducedMotion, useScroll, useTransform, useMotionValue, useSpring, AnimatePresence } from 'framer-motion'
import { FileUp, Loader2, Maximize2, Minimize2, AlertCircle } from 'lucide-react'
import { trackProduct } from '@/lib/product-analytics'
import { savePendingImport } from '@/lib/pending-import'
import { MAX_PDF_BYTES, humanBytes } from '@/lib/uploads'
import type { Book, Page } from '@/lib/book-schema'
import { MagneticButton } from './MagneticButton'

const HeroShowcase = dynamic(() => import('./HeroShowcase'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[var(--qlico-subtle)]" />,
})

const ViewerChrome = dynamic(
  () => import('@/components/viewer/ViewerChrome').then((m) => m.ViewerChrome),
  { ssr: false }
)

const PREVIEW_PAGES = 6
type Status = 'idle' | 'rendering' | 'ready' | 'error'

/** Word-by-word blur-up reveal for the hero headline. */
function HeadlineReveal({ text, className = '' }: { text: string; className?: string }) {
  const reduce = useReducedMotion()
  const words = text.split(/(\s+|\n)/)
  return (
    <h1 className={className}>
      {words.map((w, i) => {
        if (w === '\n') return <br key={i} className="hidden sm:block" />
        if (w.trim() === '') return <span key={i}>&nbsp;</span>
        
        return (
          <m.span
            key={i}
            className="inline-block"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, filter: 'blur(8px)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={
              reduce
                ? { duration: 0.3 }
                : { type: 'spring', stiffness: 140, damping: 20, delay: 0.1 + (i * 0.04) }
            }
          >
            {w}
          </m.span>
        )
      })}
    </h1>
  )
}

export function Hero() {
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Sandbox State
  const [status, setStatus] = useState<Status>('idle')
  const [dragging, setDragging] = useState(false)
  const [progress, setProgress] = useState({ current: 0, total: 0 })
  const [error, setError] = useState('')
  const [book, setBook] = useState<Book | null>(null)
  const [file, setFile] = useState<File | null>(null)
  const [saving, setSaving] = useState(false)
  const [isFullscreen, setIsFullscreen] = useState(false)

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
        setError(`That PDF is ${humanBytes(picked.size)} — the limit is ${humanBytes(MAX_PDF_BYTES)}.`)
        return
      }

      revokeAll()
      setFile(picked)
      setError('')
      setStatus('rendering')
      setProgress({ current: 0, total: 0 })
      trackProduct('try_upload_started', {
        file_mb: Math.round((picked.size / 1024 / 1024) * 10) / 10,
        location: 'hero_sandbox'
      })

      try {
        const { renderPdfPages } = await import('@/lib/pdf-renderer')
        const rendered = await renderPdfPages(picked, {
          maxPages: PREVIEW_PAGES,
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
        trackProduct('try_preview_shown', { pages: rendered.length, location: 'hero_sandbox' })
      } catch (err) {
        setStatus('error')
        const message = err instanceof Error ? err.message : 'We couldn’t open that PDF.'
        setError(message)
        trackProduct('try_failed', { reason: message.slice(0, 80), location: 'hero_sandbox' })
      }
    },
    [revokeAll]
  )

  const claim = useCallback(async () => {
    if (!file) return
    setSaving(true)
    trackProduct('try_claim_clicked', { location: 'hero_sandbox' })
    const stored = await savePendingImport(file)
    router.push(
      `/login?next=${encodeURIComponent(stored ? '/dashboard?resume=1' : '/dashboard?new=1')}`
    )
  }, [file, router])

  // Parallax constraints
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] })
  const scrollRotateX = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [12, 0])
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [0.95, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.55], [0.35, 1])

  const mouseX = useMotionValue(0.5)
  const mouseY = useMotionValue(0.5)
  const springConfig = { damping: 25, stiffness: 150 }
  const mouseRotateX = useSpring(useTransform(mouseY, [0, 1], [4, -4]), springConfig)
  const mouseRotateY = useSpring(useTransform(mouseX, [0, 1], [-4, 4]), springConfig)

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!ref.current || reduce) return
    const rect = ref.current.getBoundingClientRect()
    mouseX.set((e.clientX - rect.left) / rect.width)
    mouseY.set((e.clientY - rect.top) / rect.height)
  }

  const handleMouseLeave = () => {
    if (reduce) return
    mouseX.set(0.5)
    mouseY.set(0.5)
  }

  return (
    <>
      {/* Fullscreen expanded view portal if the book is ready */}
      <AnimatePresence>
        {isFullscreen && book && (
          <m.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 z-[100] flex flex-col bg-[var(--qlico-paper)] p-4 sm:p-6 backdrop-blur"
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-fg)]">Live Preview</p>
                <p className="font-display text-2xl font-semibold">{book.title}</p>
              </div>
              <button
                onClick={() => setIsFullscreen(false)}
                className="flex h-12 w-12 items-center justify-center rounded-full bg-[var(--qlico-subtle)] transition hover:bg-[var(--qlico-border)]"
              >
                <Minimize2 size={18} />
              </button>
            </div>
            <div className="flex-1 min-h-0 rounded-[1.5rem] overflow-hidden bg-[var(--qlico-subtle)] border border-[var(--qlico-border)]">
              <ViewerChrome book={book} showBadge={false} embed />
            </div>
            <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[1.5rem] bg-[var(--qlico-subtle)] border border-[var(--qlico-border)] p-5">
              <div>
                <p className="font-semibold">Keep it, and find out who reads it.</p>
                <p className="text-sm text-[var(--qlico-muted)]">Sign in to unlock analytics for this edition.</p>
              </div>
              <button
                onClick={claim}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)] disabled:opacity-60"
              >
                {saving && <Loader2 size={16} className="animate-spin" />}
                {saving ? 'Saving…' : 'Save this edition'}
              </button>
            </div>
          </m.div>
        )}
      </AnimatePresence>

      <section 
        className="relative overflow-hidden px-5 pb-16 pt-32 text-center sm:pt-40 transition-colors duration-500"
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
      >
        <input
          ref={inputRef}
          type="file"
          accept=".pdf,application/pdf"
          className="sr-only"
          onChange={(e) => handleFile(e.target.files?.[0])}
        />

        {/* Global Drag Overlay */}
        <AnimatePresence>
          {dragging && (
            <m.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-4 z-50 rounded-[2rem] border-4 border-dashed border-[var(--accent)] bg-[var(--background)]/80 backdrop-blur-sm flex flex-col items-center justify-center pointer-events-none"
            >
              <m.div
                animate={{ y: [0, -10, 0], scale: [1, 1.05, 1] }}
                transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
                className="flex h-24 w-24 items-center justify-center rounded-3xl bg-[var(--accent)] shadow-[0_0_60px_rgba(255,59,0,0.4)]"
              >
                <FileUp size={40} className="text-[var(--accent-contrast)]" />
              </m.div>
              <h2 className="mt-6 font-display text-4xl font-bold text-[var(--accent-fg)]">Drop to generate edition</h2>
            </m.div>
          )}
        </AnimatePresence>

        <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
          <m.div
            className="absolute left-[15%] top-[-10%] h-[600px] w-[600px] rounded-full bg-[var(--qlico-brass)]/10 blur-[120px]"
            animate={{ x: [0, 60, 0], y: [0, 30, 0] }}
            transition={{ duration: 20, repeat: Infinity, ease: 'easeInOut' }}
          />
          <m.div
            className="absolute right-[15%] top-[10%] h-[500px] w-[500px] rounded-full bg-[var(--accent)]/5 blur-[120px]"
            animate={{ x: [0, -60, 0], y: [0, -30, 0] }}
            transition={{ duration: 24, repeat: Infinity, ease: 'easeInOut' }}
          />
        </div>

        <div className="mx-auto max-w-4xl relative z-10 pt-8">
          <m.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="flex flex-col items-center justify-center gap-4"
          >
            <div className="h-10 w-[1px] bg-gradient-to-b from-transparent to-[var(--accent)]/40 mb-2"></div>
            <span className="font-display text-[11px] font-semibold uppercase tracking-[0.2em] text-[var(--qlico-muted)]">
              The intelligent document format
            </span>
          </m.div>
          
          <HeadlineReveal
            text={status === 'rendering' ? "Processing your\ndocument..." : "Turn flat PDFs into\ncinematic experiences."}
            className="font-display mt-8 text-5xl font-normal leading-[1.05] tracking-[-0.02em] sm:text-6xl lg:text-[5.5rem] lg:leading-[0.95]"
          />
          
          <m.p
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
            className="mx-auto mt-7 max-w-2xl text-xl leading-8 text-[var(--qlico-muted)]"
          >
            {status === 'rendering' 
              ? progress.total > 0 ? `Turning page ${progress.current} of ${progress.total}...` : 'Reading layers and compiling assets...'
              : 'Send a link that feels like a physical object. QLICO turns flat documents into living editions with fluid page turns, shoppable hotspots, and deep analytics.'
            }
          </m.p>

          {error && (
            <m.p
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="mx-auto mt-6 flex max-w-sm items-start gap-2 rounded-xl border border-red-200 bg-red-50 p-4 text-left text-sm text-red-700"
            >
              <AlertCircle size={18} className="shrink-0" />
              {error}
            </m.p>
          )}

          <m.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.65, duration: 0.6 }}
            className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row"
          >
            {status === 'ready' && book ? (
              <MagneticButton
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  claim()
                }}
                className="w-full rounded-full bg-[var(--accent)] px-8 py-3.5 text-center text-[15px] font-medium text-[var(--accent-contrast)] shadow-lg shadow-[var(--accent)]/10 transition-colors hover:bg-[var(--accent-hover)] sm:w-auto"
              >
                {saving ? 'Saving...' : 'Save this edition'}
              </MagneticButton>
            ) : status === 'rendering' ? (
              <div className="flex items-center gap-2 rounded-full bg-[var(--qlico-subtle)] px-7 py-3.5 text-center text-[15px] font-semibold text-[var(--qlico-muted)]">
                <Loader2 size={18} className="animate-spin text-[var(--accent)]" />
                Working magic
              </div>
            ) : (
              <MagneticButton
                href="#"
                onClick={(e) => {
                  e.preventDefault()
                  inputRef.current?.click()
                }}
                className="w-full rounded-full bg-[var(--accent)] px-8 py-3.5 text-center text-[15px] font-medium text-[var(--accent-contrast)] shadow-lg shadow-[var(--accent)]/10 transition-colors hover:bg-[var(--accent-hover)] sm:w-auto"
              >
                Drop in a PDF
              </MagneticButton>
            )}

            {!book && status !== 'rendering' && (
              <Link
                href="/book/demo"
                onClick={() => trackProduct('demo_opened', { edition: 'demo', location: 'hero' })}
                className="text-[15px] font-medium text-[var(--accent-fg)] transition hover:underline"
              >
                View the demo →
              </Link>
            )}
          </m.div>
        </div>

        {/* 3D Product Sandbox */}
        <div 
          ref={ref} 
          className="relative mx-auto mt-16 max-w-5xl z-10" 
          style={{ perspective: 1400 }}
          onMouseMove={handleMouseMove}
          onMouseLeave={handleMouseLeave}
        >
          <m.div style={{ rotateX: scrollRotateX, scale, opacity, transformStyle: 'preserve-3d' }}>
            <m.div
              style={{ rotateX: mouseRotateX, rotateY: mouseRotateY, transformStyle: 'preserve-3d' }}
              className="relative overflow-hidden rounded-[1.5rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)] shadow-[0_50px_140px_-30px_rgba(0,0,0,0.4)]"
            >
              <div className="flex items-center justify-between border-b border-[var(--qlico-hairline)] bg-[#fbfbfd] px-4 py-3">
                <div className="flex items-center gap-1.5">
                  <span className="h-3 w-3 rounded-full bg-[#e1e1e6]" />
                  <span className="h-3 w-3 rounded-full bg-[#e1e1e6]" />
                  <span className="h-3 w-3 rounded-full bg-[#e1e1e6]" />
                </div>
                {status === 'ready' && book ? (
                   <span className="mx-auto flex items-center gap-1.5 rounded-md bg-[var(--qlico-paper)] px-3 py-1 text-left text-xs font-semibold text-[var(--accent-fg)] shadow-sm">
                    {book.title}
                  </span>
                ) : (
                  <a
                    href="/book/demo"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mx-auto flex items-center gap-1.5 rounded-md bg-[var(--qlico-paper)] px-3 py-1 text-left text-xs text-[var(--qlico-muted)] shadow-sm transition-colors hover:text-[var(--qlico-ink)]"
                  >
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                    qlico.app/book/demo
                  </a>
                )}
                {status === 'ready' && (
                  <button 
                    onClick={() => setIsFullscreen(true)}
                    className="text-[var(--qlico-muted)] hover:text-[var(--qlico-ink)]"
                  >
                    <Maximize2 size={16} />
                  </button>
                )}
              </div>
              
              <div className="group relative block aspect-[16/10] bg-[var(--qlico-subtle)]">
                {status === 'ready' && book ? (
                  <ViewerChrome book={book} showBadge={false} embed />
                ) : (
                  <>
                    <HeroShowcase />
                    {/* Click-through affordance */}
                    <a href="/book/demo" target="_blank" rel="noopener noreferrer" className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent py-4 text-xs font-semibold text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100 z-10">
                      Open the live edition →
                    </a>
                  </>
                )}
              </div>
            </m.div>
          </m.div>
          {/* Soft floor reflection */}
          <div
            aria-hidden
            className="pointer-events-none absolute -bottom-10 left-1/2 -z-10 h-24 w-[78%] -translate-x-1/2 rounded-[50%] bg-[var(--tint-strong)] blur-3xl"
          />
        </div>
      </section>
    </>
  )
}
