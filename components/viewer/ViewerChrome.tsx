'use client'

import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { motion, useReducedMotion } from 'framer-motion'
import { ChevronLeft, ChevronRight, Maximize, Minimize, ZoomIn, ZoomOut } from 'lucide-react'
import { ViewerEngine, ViewerEngineHandle } from './ViewerEngine'
import { KeyboardHints } from './KeyboardHints'
import { ForeEdge } from './ForeEdge'
import type { Book } from '@/lib/book-schema'

const MIN_ZOOM = 0.7
const MAX_ZOOM = 2
const ZOOM_STEP = 0.1
/** Width of the reading frame at 100%; scales with zoom. */
const BASE_FRAME_WIDTH = 1040

/** Keeps the label off values like 109.99999%. */
function round1(n: number) {
  return Math.round(n * 10) / 10
}

function subscribeToFullscreen(onChange: () => void) {
  document.addEventListener('fullscreenchange', onChange)
  return () => document.removeEventListener('fullscreenchange', onChange)
}

/** Capability checks never change after load, but still need a subscriber. */
function subscribeToNothing() {
  return () => {}
}

/** Relative luminance of a hex color (1 = white). */
function luminance(hex: string): number {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return 1
  const [r, g, b] = [m[1], m[2], m[3]].map((h) => parseInt(h, 16) / 255)
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** A one-time "open the book" moment — the closed cover swings away on entry. */
function CoverOpen({ book }: { book: Book }) {
  const reduce = useReducedMotion()
  const [show, setShow] = useState(false)

  useEffect(() => {
    if (reduce) return
    const key = `qlico:opened:${book.id}`
    try {
      if (sessionStorage.getItem(key)) return // already opened this session
      sessionStorage.setItem(key, '1')
    } catch {
      // sessionStorage unavailable — still play once for this mount
    }
    setShow(true)
  }, [book.id, reduce])

  if (!show) return null

  const color = book.pages?.[0]?.background?.color || book.theme?.background || '#1d1d1f'
  const dark = /^#[0-9a-f]{6}$/i.test(color) ? luminance(color) < 0.5 : true
  const fg = dark ? '#ffffff' : '#1d1d1f'

  return (
    <div className="pointer-events-none fixed inset-0 z-[9500]" style={{ perspective: 2200 }}>
      <motion.div
        className="absolute inset-0 flex items-center justify-center origin-left"
        style={{ background: color, transformStyle: 'preserve-3d', backfaceVisibility: 'hidden', boxShadow: '0 0 120px rgba(0,0,0,0.45)' }}
        initial={{ rotateY: 0 }}
        animate={{ rotateY: -112 }}
        transition={{ delay: 0.2, duration: 1, ease: [0.7, 0, 0.25, 1] }}
        onAnimationComplete={() => setShow(false)}
      >
        <span className="absolute left-0 top-0 h-full w-2.5" style={{ background: 'rgba(0,0,0,0.18)' }} />
        <div className="text-center" style={{ color: fg }}>
          <p className="text-xs font-semibold uppercase tracking-[0.3em] opacity-70">Vol. 01</p>
          <p className="font-display mt-3 text-5xl font-semibold tracking-[-0.02em] sm:text-6xl">{book.title}</p>
        </div>
      </motion.div>
    </div>
  )
}

export function ViewerChrome({ book, embed = false }: { book: Book; embed?: boolean }) {
  const engineRef = useRef<ViewerEngineHandle>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [zoom, setZoom] = useState(1)
  const reduce = useReducedMotion()

  const totalPages = book.pages?.length ?? 0

  // The button used to track its own state, so leaving fullscreen any other
  // way — Escape, F11, the OS chrome — left the icon showing "exit" while the
  // page was already windowed. The browser is the only source of truth, so
  // subscribe to it rather than mirroring it into React state.
  const fullscreen = useSyncExternalStore(
    subscribeToFullscreen,
    () => Boolean(document.fullscreenElement),
    () => false
  )

  // iOS Safari has no Element.requestFullscreen — don't offer a button that
  // can't do anything there.
  const canFullscreen = useSyncExternalStore(
    subscribeToNothing,
    () => typeof document.documentElement.requestFullscreen === 'function',
    () => false
  )

  async function toggleFullscreen() {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen()
      } else {
        await document.exitFullscreen()
      }
    } catch {
      // Rejected requests (permissions policy, no user gesture) fire no
      // `fullscreenchange`, so there's nothing to re-sync — the subscribed
      // value already reflects reality.
    }
  }

  return (
    <div className="flex w-full flex-col items-center gap-4">
      {!embed && <CoverOpen book={book} />}
      {/* Book settles in as the cover lifts away. Capped width keeps a
          comfortable margin around the spread instead of edge-to-edge zoom. */}
      <motion.div
        className="mx-auto w-full"
        // The frame has to widen with the zoom, or the engine's own
        // `container / 2` clamp swallows anything past ~113%.
        style={{ maxWidth: Math.round(BASE_FRAME_WIDTH * zoom) }}
        initial={reduce ? { opacity: 0 } : { opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: reduce ? 0 : 0.15, duration: reduce ? 0.3 : 0.6, ease: [0.22, 1, 0.36, 1] }}
      >
        <ViewerEngine
          ref={engineRef}
          book={book}
          onFlip={setCurrentPage}
          embed={embed}
          zoom={zoom}
        />
      </motion.div>

      {!embed && (
        <ForeEdge
          total={totalPages}
          current={currentPage}
          onSeek={(i) => engineRef.current?.goTo(i)}
        />
      )}

      {!embed && (
        // Sticky: zooming in makes the spread taller than the viewport, which
        // used to scroll the very controls you were using out of sight.
        <div className="sticky bottom-4 z-40 flex items-center gap-3 rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/80 px-4 py-3 text-[var(--qlico-ink)] shadow-[0_12px_40px_rgba(0,0,0,0.12)] backdrop-blur-2xl sm:gap-6 sm:px-6">
          <button
            onClick={() => engineRef.current?.flipPrev()}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-[var(--tint)] disabled:opacity-30"
            aria-label="Previous page"
            disabled={currentPage === 0}
          >
            <ChevronLeft size={20} />
          </button>

          <span className="min-w-[80px] text-center text-sm font-semibold tabular-nums tracking-[0.08em]">
            {currentPage + 1} / {totalPages}
          </span>

          <button
            onClick={() => engineRef.current?.flipNext()}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-[var(--tint)] disabled:opacity-30"
            aria-label="Next page"
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight size={20} />
          </button>

          {/* A capped spread left a large display mostly empty with no way to
              fill it. Desktop only — on a phone the page already spans the
              full width. */}
          <div className="hidden items-center gap-1 md:flex">
            <span className="mx-1 h-5 w-px bg-[var(--tint)]" aria-hidden="true" />
            <button
              onClick={() => setZoom((z) => Math.max(MIN_ZOOM, round1(z - ZOOM_STEP)))}
              disabled={zoom <= MIN_ZOOM}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-[var(--tint)] disabled:opacity-30"
              aria-label="Zoom out"
            >
              <ZoomOut size={18} />
            </button>
            <button
              onClick={() => setZoom(1)}
              className="min-w-[52px] rounded-full px-1 py-1 text-xs font-semibold tabular-nums transition-colors hover:bg-[var(--tint)]"
              aria-label={`Zoom ${Math.round(zoom * 100)} percent — reset to 100 percent`}
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom((z) => Math.min(MAX_ZOOM, round1(z + ZOOM_STEP)))}
              disabled={zoom >= MAX_ZOOM}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-[var(--tint)] disabled:opacity-30"
              aria-label="Zoom in"
            >
              <ZoomIn size={18} />
            </button>
          </div>

          {canFullscreen && (
            <button
              onClick={toggleFullscreen}
              className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-[var(--tint)]"
              aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
              aria-pressed={fullscreen}
            >
              {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
            </button>
          )}
        </div>
      )}

      {!embed && <KeyboardHints />}

      {/* Accessible page announcements */}
      <div className="sr-only" aria-live="polite">
        Page {currentPage + 1} of {totalPages}
      </div>

      {/* Branding */}
      {!book.settings?.whitelabel && (
        <a
          href="https://qlico.app?via=watermark"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-4 right-4 z-[9000] rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/85 px-3 py-1.5 text-xs font-semibold text-[var(--qlico-muted)] shadow-sm backdrop-blur-md transition-colors hover:text-[var(--qlico-ink)]"
        >
          Powered by <span className="font-display font-semibold text-[var(--qlico-ink)]">QLICO</span>
        </a>
      )}
    </div>
  )
}
