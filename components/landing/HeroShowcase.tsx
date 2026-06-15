'use client'

import { useEffect, useRef, useState } from 'react'
import { AnimatePresence, animate, motion, useInView, useReducedMotion } from 'framer-motion'

const IMG_EDITORIAL = 'https://images.unsplash.com/photo-1481627834876-b7833e8f5570?w=900&q=70'
const IMG_HOTSPOT = 'https://images.unsplash.com/photo-1519389950473-47ba0277781c?w=900&q=70'

const SCENES = ['cover', 'editorial', 'hotspot', 'analytics'] as const
const HOLD_MS = 3000

function CountUp({ to, suffix }: { to: number; suffix: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { amount: 0.6 })
  const reduce = useReducedMotion()
  useEffect(() => {
    const el = ref.current
    if (!el) return
    if (reduce || !inView) {
      el.textContent = `${to}${suffix}`
      return
    }
    const controls = animate(0, to, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => (el.textContent = `${Math.round(v)}${suffix}`),
    })
    return () => controls.stop()
  }, [inView, to, suffix, reduce])
  return <span ref={ref}>0{suffix}</span>
}

function AnalyticsBars() {
  const reduce = useReducedMotion()
  const bars = [40, 66, 52, 84, 60, 96, 72]
  return (
    <div className="flex h-24 items-end gap-2">
      {bars.map((h, i) => (
        <motion.span
          key={i}
          className="w-full rounded-t-sm bg-[var(--accent)]"
          initial={{ height: reduce ? `${h}%` : '6%' }}
          animate={{ height: `${h}%` }}
          transition={{ delay: 0.15 + i * 0.07, type: 'spring', stiffness: 120, damping: 15 }}
        />
      ))}
    </div>
  )
}

function Scene({ name }: { name: (typeof SCENES)[number] }) {
  if (name === 'cover') {
    return (
      <div className="flex h-full w-full flex-col items-center justify-center bg-[#fbfbfd] px-10 text-center">
        <motion.p
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="text-[11px] font-semibold uppercase tracking-[0.28em] text-[var(--folio-muted)]"
        >
          Interactive publishing
        </motion.p>
        <motion.h3
          initial={{ opacity: 0, y: 14, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={{ delay: 0.25, type: 'spring', stiffness: 120, damping: 18 }}
          className="font-display mt-3 text-6xl font-semibold tracking-[-0.02em] text-[var(--folio-ink)]"
        >
          Riffle
        </motion.h3>
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.5 }}
          className="mt-3 text-lg text-[var(--folio-muted)]"
        >
          Flip through anything.
        </motion.p>
        <motion.span
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65 }}
          className="mt-7 rounded-full bg-[var(--accent)] px-6 py-2.5 text-sm font-semibold text-white"
        >
          Start reading →
        </motion.span>
      </div>
    )
  }

  if (name === 'editorial') {
    return (
      <div className="grid h-full w-full grid-cols-2 bg-white">
        <div className="flex flex-col justify-center gap-4 p-10">
          <motion.h3
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2, type: 'spring', stiffness: 110, damping: 18 }}
            className="font-display text-4xl font-semibold leading-tight tracking-[-0.02em] text-[var(--folio-ink)]"
          >
            Typography that reads like print
          </motion.h3>
          <motion.p
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="text-[15px] leading-7 text-[var(--folio-muted)]"
          >
            A full type system — titles, headings, quotes, and captions — so every page feels composed.
          </motion.p>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.55 }}
            className="border-l-2 border-[var(--accent)] pl-4 font-display text-lg italic text-[var(--folio-ink)]"
          >
            “The best documents feel considered.”
          </motion.div>
        </div>
        <motion.div
          initial={{ opacity: 0, scale: 1.04 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2, duration: 0.7 }}
          className="h-full w-full bg-cover bg-center"
          style={{ backgroundImage: `url(${IMG_EDITORIAL})` }}
        />
      </div>
    )
  }

  if (name === 'hotspot') {
    return (
      <div className="relative h-full w-full bg-cover bg-center" style={{ backgroundImage: `url(${IMG_HOTSPOT})` }}>
        <div className="absolute inset-0 bg-black/45" />
        <div className="relative flex h-full flex-col items-center justify-center px-10 text-center">
          <motion.h3
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="font-display text-4xl font-semibold tracking-[-0.02em] text-white"
          >
            Interactive hotspots
          </motion.h3>
          {/* pulsing dots */}
          {[
            { x: '24%', y: '40%' },
            { x: '70%', y: '58%' },
          ].map((d, i) => (
            <span key={i} className="folio-pulse absolute h-3 w-3 rounded-full bg-[var(--accent)]" style={{ left: d.x, top: d.y }} />
          ))}
          {/* callout card */}
          <motion.div
            initial={{ opacity: 0, y: 10, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ delay: 0.7, type: 'spring', stiffness: 130, damping: 16 }}
            className="absolute bottom-8 left-8 max-w-[15rem] rounded-2xl bg-white/95 p-4 text-left shadow-xl backdrop-blur"
          >
            <p className="text-sm font-semibold text-[var(--folio-ink)]">Built-in analytics</p>
            <p className="mt-1 text-xs leading-5 text-[var(--folio-muted)]">Opens, dwell time, and hotspot clicks — in your own data layer.</p>
          </motion.div>
        </div>
      </div>
    )
  }

  // analytics
  return (
    <div className="flex h-full w-full flex-col justify-center gap-6 bg-[var(--folio-ink)] px-10 text-white">
      <div className="flex items-end justify-between">
        <h3 className="font-display text-4xl font-semibold tracking-[-0.02em]">Numbers that land</h3>
        <div className="font-display text-5xl font-semibold text-[var(--accent)]">
          <CountUp to={10} suffix="×" />
        </div>
      </div>
      <AnalyticsBars />
      <p className="text-sm text-white/60">More engaging than a static PDF — measured, every time.</p>
    </div>
  )
}

/** A self-playing flipbook reel — the product story on a 4-scene loop. */
export default function HeroShowcase() {
  const [index, setIndex] = useState(0)
  const reduce = useReducedMotion()
  const paused = useRef(false)

  useEffect(() => {
    // Preload scene imagery so the first loop is crisp.
    ;[IMG_EDITORIAL, IMG_HOTSPOT].forEach((src) => {
      const img = new window.Image()
      img.src = src
    })
  }, [])

  useEffect(() => {
    const id = setInterval(() => {
      if (!paused.current) setIndex((i) => (i + 1) % SCENES.length)
    }, HOLD_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div
      className="relative h-full w-full overflow-hidden bg-[#f5f5f7]"
      style={{ perspective: 2000 }}
      onMouseEnter={() => (paused.current = true)}
      onMouseLeave={() => (paused.current = false)}
    >
      <AnimatePresence initial={false}>
        <motion.div
          key={index}
          className="absolute inset-0 origin-left [backface-visibility:hidden]"
          initial={reduce ? { opacity: 0 } : { rotateY: 92, opacity: 0.5 }}
          animate={reduce ? { opacity: 1 } : { rotateY: 0, opacity: 1 }}
          exit={reduce ? { opacity: 0 } : { rotateY: -92, opacity: 0.5 }}
          transition={{ duration: reduce ? 0.4 : 0.85, ease: [0.22, 1, 0.36, 1] }}
        >
          <Scene name={SCENES[index]} />
        </motion.div>
      </AnimatePresence>

      {/* Progress segments */}
      <div className="absolute bottom-3 left-1/2 z-10 flex -translate-x-1/2 gap-1.5">
        {SCENES.map((s, i) => (
          <span
            key={s}
            className={`h-1 rounded-full transition-all duration-300 ${
              i === index ? 'w-6 bg-[var(--folio-ink)]/70' : 'w-1.5 bg-[var(--folio-ink)]/25'
            }`}
          />
        ))}
      </div>
    </div>
  )
}
