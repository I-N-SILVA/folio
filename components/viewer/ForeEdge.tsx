'use client'

import { useRef, useState } from 'react'
import { useReducedMotion } from 'framer-motion'

type Props = {
  total: number
  current: number
  onSeek: (index: number) => void
}

const clamp = (v: number, a: number, b: number) => Math.min(b, Math.max(a, v))

/**
 * The fore-edge: the stacked page edges of the book, rendered as a vertical
 * scrubber on desktop, and a compact touch scrubber on mobile.
 * Hovering/touching fans the pages out (a "riffle"); click or drag to fly
 * to any page. The signature QLICO interaction.
 */
export function ForeEdge({ total, current, onSeek }: Props) {
  const reduce = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const mobileRef = useRef<HTMLDivElement>(null)
  const dragging = useRef(false)
  const [hover, setHover] = useState<number | null>(null)

  if (total < 2) return null

  function indexFromY(clientY: number) {
    const r = ref.current?.getBoundingClientRect()
    if (!r) return current
    const t = clamp((clientY - r.top) / r.height, 0, 1)
    return Math.round(t * (total - 1))
  }

  function indexFromX(clientX: number) {
    const r = mobileRef.current?.getBoundingClientRect()
    if (!r) return current
    const t = clamp((clientX - r.left) / r.width, 0, 1)
    return Math.round(t * (total - 1))
  }

  function handleMove(e: React.PointerEvent) {
    const i = indexFromY(e.clientY)
    setHover(i)
    if (dragging.current) onSeek(i)
  }

  function handleMobileMove(e: React.PointerEvent) {
    const i = indexFromX(e.clientX)
    setHover(i)
    if (dragging.current) onSeek(i)
  }

  const focus = hover ?? current
  const sigma = 3.2
  const maxBump = reduce ? 0 : 30

  return (
    <>
      {/* Desktop Vertical Fore-Edge Scrubber */}
      <div className="pointer-events-none fixed right-3 top-1/2 z-[8000] hidden -translate-y-1/2 sm:block">
        <div
          ref={ref}
          className="pointer-events-auto relative flex cursor-pointer touch-none flex-col items-end justify-center gap-[3px] py-4 pl-10 pr-1"
          onPointerDown={(e) => {
            dragging.current = true
            ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            onSeek(indexFromY(e.clientY))
          }}
          onPointerUp={() => (dragging.current = false)}
          onPointerMove={handleMove}
          onPointerLeave={() => {
            dragging.current = false
            setHover(null)
          }}
          aria-label="QLICO through pages"
          role="slider"
          aria-valuemin={1}
          aria-valuemax={total}
          aria-valuenow={current + 1}
        >
          {Array.from({ length: total }).map((_, i) => {
            const d = i - focus
            const bump = maxBump * Math.exp(-(d * d) / (2 * sigma * sigma))
            const isActive = i === current
            const width = 14 + bump + (isActive ? 8 : 0)
            return (
              <span
                key={i}
                style={{ width }}
                className={`h-[2px] rounded-full transition-[width,background-color] duration-150 ease-out ${
                  isActive
                    ? 'bg-[var(--accent)]'
                    : hover === i
                      ? 'bg-[var(--qlico-ink)]/70'
                      : 'bg-[var(--qlico-ink)]/25'
                }`}
              />
            )
          })}

          {/* Page number bubble that follows the cursor */}
          {hover !== null && (
            <span
              className="absolute right-full mr-2 rounded-full bg-[var(--invert-surface)] px-2 py-0.5 text-[11px] font-semibold tabular-nums text-[var(--invert-text)] shadow-md"
              style={{ top: `${(hover / (total - 1)) * 100}%`, transform: 'translateY(-50%)' }}
            >
              {hover + 1}
            </span>
          )}
        </div>
      </div>

      {/* Mobile Horizontal Scrubber Pill */}
      <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2 sm:hidden">
        <div
          ref={mobileRef}
          className="relative flex h-8 items-center gap-[2px] rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/90 px-3 py-1 shadow-lg backdrop-blur-xl touch-none cursor-pointer"
          onPointerDown={(e) => {
            dragging.current = true
            ;(e.target as HTMLElement).setPointerCapture?.(e.pointerId)
            onSeek(indexFromX(e.clientX))
          }}
          onPointerUp={() => (dragging.current = false)}
          onPointerMove={handleMobileMove}
          onPointerLeave={() => {
            dragging.current = false
            setHover(null)
          }}
          aria-label="Mobile page scrubber"
        >
          {Array.from({ length: Math.min(total, 32) }).map((_, i) => {
            const mappedIndex = Math.round((i / (Math.min(total, 32) - 1)) * (total - 1))
            const isActive = mappedIndex === current
            return (
              <span
                key={i}
                className={`w-[2px] rounded-full transition-all duration-150 ${
                  isActive
                    ? 'h-4 bg-[var(--accent)]'
                    : 'h-2 bg-[var(--qlico-ink)]/30'
                }`}
              />
            )
          })}
          {hover !== null && (
            <span className="absolute -top-7 left-1/2 -translate-x-1/2 rounded-full bg-[var(--invert-surface)] px-2 py-0.5 text-[10px] font-semibold tabular-nums text-[var(--invert-text)] shadow-md">
              Page {hover + 1}
            </span>
          )}
        </div>
      </div>
    </>
  )
}

