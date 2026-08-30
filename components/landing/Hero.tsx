'use client'

import { useRef, useEffect, useState, useCallback } from 'react'
import { motion, useMotionValue, useSpring, useTransform, AnimatePresence } from 'framer-motion'
import { FileUp, Loader2, AlertCircle, X, Maximize2, Minimize2 } from 'lucide-react'
import dynamic from 'next/dynamic'
import { useRouter } from 'next/navigation'
import { MAX_PDF_BYTES, humanBytes } from '@/lib/uploads'
import { savePendingImport } from '@/lib/pending-import'
import { trackProduct } from '@/lib/product-analytics'
import { DEMO_BOOKS } from '@/data/books'
import type { Book, Page } from '@/lib/book-schema'

const ViewerChrome = dynamic(
  () => import('@/components/viewer/ViewerChrome').then((m) => m.ViewerChrome),
  { ssr: false }
)

const PREVIEW_PAGES = 6
type Status = 'idle' | 'rendering' | 'ready' | 'error'

const IMAGES = [
  '/assets/hero_cover_1_1787417516940.jpg',
  '/assets/hero_cover_2_1787417533333.jpg',
  '/assets/hero_cover_3_1787417544237.jpg',
  '/assets/hero_cover_4_1787417555268.jpg',
  '/assets/hero_cover_5_1787417566803.jpg',
  '/assets/hero_cover_6_1787417577923.jpg',
]

const TUNNEL_POSITIONS = [
  { x: '-45vw', y: '-20vh', rotateZ: -12, zOffset: 0 },
  { x: '40vw', y: '10vh', rotateZ: 8, zOffset: -150 },
  { x: '-30vw', y: '40vh', rotateZ: 20, zOffset: -300 },
  { x: '45vw', y: '-30vh', rotateZ: -15, zOffset: -450 },
  { x: '-15vw', y: '-45vh', rotateZ: -5, zOffset: -600 },
  { x: '25vw', y: '45vh', rotateZ: 10, zOffset: -750 },
  { x: '-40vw', y: '15vh', rotateZ: 18, zOffset: -900 },
  { x: '35vw', y: '-10vh', rotateZ: -8, zOffset: -1050 },
  { x: '-20vw', y: '35vh', rotateZ: -25, zOffset: -1200 },
  { x: '50vw', y: '30vh', rotateZ: 15, zOffset: -1350 },
  { x: '-5vw', y: '-50vh', rotateZ: 12, zOffset: -1500 },
  { x: '10vw', y: '50vh', rotateZ: -10, zOffset: -1650 },
]

const SEGMENT_LENGTH = 1800

function TunnelSegment({ offsetZ }: { offsetZ: number }) {
  return (
    <div 
      className="absolute inset-0" 
      style={{ transform: `translateZ(${offsetZ}px)`, transformStyle: 'preserve-3d' }}
    >
      {TUNNEL_POSITIONS.map((pos, i) => {
        const src = IMAGES[i % IMAGES.length]
        return (
          <div 
            key={i} 
            className="absolute left-1/2 top-1/2 w-48 md:w-64 aspect-[3/4] -ml-24 md:-ml-32 -mt-36 md:-mt-48 rounded-lg shadow-2xl overflow-hidden border border-white/10"
            style={{ 
              transform: `translate3d(${pos.x}, ${pos.y}, ${pos.zOffset}px) rotateZ(${pos.rotateZ}deg)`
            }}
          >
            <img src={src} className="w-full h-full object-cover opacity-50 transition-opacity duration-1000 hover:opacity-100" alt={`Cover ${i}`} />
            <div className="absolute inset-0 bg-black/40 mix-blend-multiply pointer-events-none" />
            <div className="absolute inset-0 ring-1 ring-inset ring-white/10 rounded-lg pointer-events-none" />
          </div>
        )
      })}
    </div>
  )
}

export function Hero() {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // --- UPLOAD STATE ---
  const router = useRouter()
  const inputRef = useRef<HTMLInputElement>(null)
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
      trackProduct('try_upload_started', { file_mb: Math.round((picked.size / 1024 / 1024) * 10) / 10 })

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
            id: `preview-${i}`, book_id: 'preview', page_number: i + 1, type: i === 0 ? 'cover' : 'content',
            layout: 'blank', background: { image: url }, blocks: [], hotspots: []
          }
        })

        setBook({
          id: 'preview', slug: 'preview', title: picked.name.replace(/\.pdf$/i, ''), owner_id: 'preview',
          theme: { preset: 'ivory' },
          settings: { published: true, unlisted: true, gating: { enabled: false, page_number: 3, type: 'email', title: '', description: '' }, whitelabel: true },
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
    const stored = await savePendingImport(file)
    router.push(`/login?next=${encodeURIComponent(stored ? '/dashboard?resume=1' : '/dashboard?new=1')}`)
  }, [file, router])

  const reset = useCallback(() => {
    revokeAll()
    setBook(null)
    setFile(null)
    setStatus('idle')
    setError('')
    setIsFullscreen(false)
  }, [revokeAll])
  // --- END UPLOAD STATE ---
  
  // Track mouse for perspective shift
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)

  const smoothX = useSpring(mouseX, { damping: 50, stiffness: 100 })
  const smoothY = useSpring(mouseY, { damping: 50, stiffness: 100 })

  const rotateX = useTransform(smoothY, [-0.5, 0.5], [10, -10])
  const rotateY = useTransform(smoothX, [-0.5, 0.5], [-10, 10])

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const { innerWidth, innerHeight } = window
      const x = (e.clientX / innerWidth) - 0.5
      const y = (e.clientY / innerHeight) - 0.5
      mouseX.set(x)
      mouseY.set(y)
    }

    window.addEventListener('mousemove', handleMouseMove)
    return () => window.removeEventListener('mousemove', handleMouseMove)
  }, [mouseX, mouseY])

  return (
    <section 
      ref={containerRef}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={(e) => {
        // Only set dragging to false if leaving the section container
        if (e.currentTarget.contains(e.relatedTarget as Node)) return
        setDragging(false)
      }}
      onDrop={(e) => {
        e.preventDefault()
        setDragging(false)
        handleFile(e.dataTransfer.files?.[0])
      }}
      className="relative flex min-h-[100svh] items-center justify-center overflow-hidden bg-[#050505] perspective-1000"
    >
      {/* Dragging Overlay */}
      <AnimatePresence>
        {dragging && status !== 'rendering' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-6 pointer-events-none"
          >
            <div className="flex flex-col items-center justify-center rounded-[2.5rem] border-2 border-dashed border-white bg-white/10 p-12 text-center shadow-2xl">
              <div className="grid h-20 w-20 place-items-center rounded-full bg-white text-black mb-4 animate-bounce">
                <FileUp size={36} strokeWidth={2} />
              </div>
              <h3 className="font-display text-3xl font-semibold text-white">Drop your PDF here</h3>
              <p className="mt-2 text-sm text-zinc-300">We'll instantly turn it into an interactive edition</p>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 3D Infinite Tunnel Scene */}
      <motion.div 
        className="absolute inset-0 pointer-events-none"
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
      >
        <motion.div
          className="absolute inset-0"
          animate={{ z: [0, SEGMENT_LENGTH] }}
          transition={{ duration: 15, ease: "linear", repeat: Infinity }}
          style={{ transformStyle: 'preserve-3d' }}
        >
          {/* We render multiple segments to ensure the tunnel is deep enough and loops seamlessly */}
          <TunnelSegment offsetZ={0} />
          <TunnelSegment offsetZ={-SEGMENT_LENGTH} />
          <TunnelSegment offsetZ={-SEGMENT_LENGTH * 2} />
          <TunnelSegment offsetZ={-SEGMENT_LENGTH * 3} />
        </motion.div>
      </motion.div>

      {/* Fog / Vignette Overlay */}
      {/* This hides the hard edges of the planes as they spawn far away, and darkens the edges of the screen */}
      <div className="absolute inset-0 z-10 bg-[radial-gradient(circle_at_center,transparent_0%,#050505_85%)] pointer-events-none" />
      <div className="absolute inset-0 z-10 bg-gradient-to-b from-[#050505] via-transparent to-[#050505] pointer-events-none opacity-80" />

      {/* Center UI Layer */}
      <div className="relative z-20 flex flex-col items-center text-center px-5 mt-10 w-full max-w-5xl mx-auto">
        <AnimatePresence mode="wait">
          {status === 'ready' && book ? (
            <motion.div
              key="viewer"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.5, ease: "easeOut" }}
              className={isFullscreen 
                ? 'fixed inset-0 z-[100] flex flex-col bg-black/90 backdrop-blur-2xl p-4 sm:p-6'
                : 'w-full flex flex-col rounded-[2rem] border border-white/10 bg-black/60 backdrop-blur-2xl p-4 shadow-2xl'
              }
            >
              <div className="mb-4 flex flex-wrap items-center justify-between gap-4">
                <div className="text-left">
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-zinc-400">Preview Edition</p>
                  <h2 className="font-display mt-1 text-2xl md:text-3xl font-semibold tracking-[-0.03em] text-white">
                    {book.title}
                  </h2>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="hidden sm:flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    {isFullscreen ? <Minimize2 size={14} /> : <Maximize2 size={14} />}
                    {isFullscreen ? 'Minimize' : 'Expand'}
                  </button>
                  <button
                    onClick={reset}
                    className="flex items-center gap-1.5 rounded-full border border-white/20 bg-white/5 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-white/10"
                  >
                    <X size={14} />
                    Try another
                  </button>
                </div>
              </div>

              <div className={isFullscreen ? 'flex-1 min-h-0 rounded-2xl overflow-hidden bg-black/40 border border-white/10' : 'h-[60vh] min-h-[420px] rounded-2xl overflow-hidden bg-black/40 border border-white/10'}>
                <ViewerChrome book={book} showBadge={false} embed />
              </div>
              
              <div className="mt-4 flex flex-col sm:flex-row items-center justify-between gap-4 rounded-[1.5rem] bg-white/5 border border-white/10 p-5">
                <div className="text-left">
                  <p className="font-semibold text-white">Keep it, and find out who reads it.</p>
                  <p className="text-sm text-zinc-400">Sign in to unlock analytics for this edition.</p>
                </div>
                <button
                  onClick={claim}
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-2.5 text-sm font-bold text-black transition hover:bg-zinc-200 disabled:opacity-60"
                >
                  {saving && <Loader2 size={16} className="animate-spin" />}
                  {saving ? 'Saving…' : 'Save this edition'}
                </button>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="hero"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center"
            >
              <motion.div 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.2 }}
                className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-black/40 backdrop-blur-xl px-4 py-1.5 text-xs font-medium tracking-widest text-zinc-300 uppercase mb-8 shadow-2xl"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-white opacity-40"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-white/80"></span>
                </span>
                QLICO 2.0
              </motion.div>
              
              <motion.h1 
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1.2, delay: 0.4, ease: "easeOut" }}
                className="font-display text-5xl sm:text-6xl md:text-8xl lg:text-[7rem] leading-[1.05] tracking-tight text-white mb-6 font-normal drop-shadow-[0_0_40px_rgba(255,255,255,0.2)]"
              >
                Publishing, <br/>
                <span className="italic text-zinc-400">Perfected.</span>
              </motion.h1>
              
              <motion.p 
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 1, delay: 0.6 }}
                className="max-w-2xl text-lg md:text-xl font-normal leading-relaxed text-zinc-400 drop-shadow-lg"
              >
                Transform static PDFs into immersive, interactive editions. No code required. Unmatched elegance.
              </motion.p>
              
              <motion.div 
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 1, delay: 0.8 }}
                className="mt-14 pointer-events-auto"
              >
                <div 
                  onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                  onDragLeave={() => setDragging(false)}
                  onDrop={(e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]) }}
                  onClick={() => {
                    if (status !== 'rendering') inputRef.current?.click()
                  }}
                  className={`group flex flex-col items-center justify-center p-8 w-[320px] rounded-[2rem] backdrop-blur-3xl shadow-[0_0_80px_rgba(255,255,255,0.03)] transition-all cursor-pointer ${
                    dragging 
                      ? 'border-2 border-white bg-white/10 scale-105' 
                      : 'border border-white/10 bg-black/40 hover:border-white/30 hover:bg-black/60'
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
                      <Loader2 size={32} className="animate-spin text-white" />
                      <p className="text-sm font-medium text-white">
                        {progress.total > 0
                          ? `Turning page ${progress.current} of ${progress.total}…`
                          : 'Opening your PDF…'}
                      </p>
                    </div>
                  ) : (
                    <>
                      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 group-hover:scale-110 group-hover:bg-white text-white group-hover:text-black transition-all duration-300">
                        <FileUp size={28} strokeWidth={2} />
                      </div>
                      <p className="mt-6 text-sm font-medium tracking-wide text-white">
                        Drag & drop your PDF
                      </p>
                      <p className="mt-1 text-xs text-zinc-500 group-hover:text-zinc-400 transition-colors">
                        or browse files to begin
                      </p>
                    </>
                  )}
                  {status === 'error' && error && (
                    <p className="mt-4 text-xs text-red-400 flex items-center gap-1 bg-red-950/50 p-2 rounded-lg border border-red-500/20 text-left">
                      <AlertCircle size={14} className="shrink-0" />
                      {error}
                    </p>
                  )}
                </div>

                {status === 'idle' && (
                  <button
                    type="button"
                    onClick={() => {
                      setBook(DEMO_BOOKS.demo)
                      setStatus('ready')
                      trackProduct('demo_opened', { slug: 'demo' })
                    }}
                    className="mt-4 inline-flex items-center gap-1.5 text-xs font-semibold text-zinc-400 hover:text-white transition-colors underline underline-offset-4"
                  >
                    Or explore sample interactive edition (Vol. 01) →
                  </button>
                )}
              </motion.div>

              {/* Scroll indicator */}
              <motion.div 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1, delay: 1.5 }}
                className="absolute -bottom-24 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 pointer-events-auto cursor-pointer"
                onClick={() => window.scrollTo({ top: window.innerHeight, behavior: 'smooth' })}
              >
                <span className="text-[10px] font-medium tracking-widest uppercase text-zinc-500">Discover</span>
                <div className="w-[1px] h-12 bg-gradient-to-b from-zinc-500 to-transparent" />
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </section>
  )
}
