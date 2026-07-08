'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useRef } from 'react'
import { m, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import { track } from '@vercel/analytics'
import { MagneticButton } from './MagneticButton'

const HeroShowcase = dynamic(() => import('./HeroShowcase'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#f5f5f7]" />,
})

/** Word-by-word blur-up reveal for the hero headline. */
function HeadlineReveal({ text, className = '' }: { text: string; className?: string }) {
  const reduce = useReducedMotion()
  const words = text.split(' ')
  return (
    <h1 className={className}>
      {words.map((w, i) => (
        <m.span
          key={i}
          className="inline-block"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, filter: 'blur(10px)' }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={
            reduce
              ? { duration: 0.3 }
              : { type: 'spring', stiffness: 130, damping: 18, delay: 0.15 + i * 0.13 }
          }
        >
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </m.span>
      ))}
    </h1>
  )
}

/** Browser mockup that straightens from a slight tilt as it scrolls in. */
function ProductShot() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] })
  const rotateX = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [12, 0])
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [0.95, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.55], [0.35, 1])

  return (
    <div ref={ref} className="relative mx-auto mt-16 max-w-5xl" style={{ perspective: 1400 }}>
      <m.div
        style={{ rotateX, scale, opacity, transformStyle: 'preserve-3d' }}
        className="relative overflow-hidden rounded-[1.5rem] border border-[var(--qlico-border)] bg-white shadow-[0_50px_140px_-30px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center gap-1.5 border-b border-[var(--qlico-hairline)] bg-[#fbfbfd] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#e1e1e6]" />
          <span className="h-3 w-3 rounded-full bg-[#e1e1e6]" />
          <span className="h-3 w-3 rounded-full bg-[#e1e1e6]" />
          <a
            href="/book/demo"
            target="_blank"
            rel="noopener noreferrer"
            className="mx-auto flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-left text-xs text-[var(--qlico-muted)] shadow-sm transition-colors hover:text-[var(--qlico-ink)]"
          >
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            qlico.app/book/demo
          </a>
        </div>
        <a href="/book/demo" target="_blank" rel="noopener noreferrer" className="group relative block aspect-[16/10] bg-[#f5f5f7]">
          <HeroShowcase />
          {/* Click-through affordance — this is a preview reel; the real, riffle-powered book is one click away. */}
          <span className="absolute inset-x-0 bottom-0 flex items-center justify-center gap-1.5 bg-gradient-to-t from-black/70 to-transparent py-4 text-xs font-semibold text-white opacity-0 transition-opacity duration-300 group-hover:opacity-100">
            Open the live edition →
          </span>
        </a>
        {/* Accent border beam */}
        <span aria-hidden className="qlico-beam" />
      </m.div>
      {/* Soft floor reflection */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 left-1/2 -z-10 h-24 w-[78%] -translate-x-1/2 rounded-[50%] bg-black/15 blur-3xl"
      />
    </div>
  )
}

export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-16 pt-32 text-center sm:pt-40">
      <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
        <m.div
          className="absolute left-[20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[var(--accent)]/15 blur-[100px]"
          animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
          transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
        />
        <m.div
          className="absolute right-[20%] top-[20%] h-[400px] w-[400px] rounded-full bg-[#00d0ff]/15 blur-[100px]"
          animate={{ x: [0, -100, 0], y: [0, -50, 0] }}
          transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
        />
      </div>
      <div className="mx-auto max-w-3xl">
        <m.span
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 rounded-full border border-[var(--qlico-border)] bg-white/70 px-3.5 py-1.5 text-[13px] font-medium text-[var(--qlico-muted)] backdrop-blur"
        >
          <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
          Interactive publishing
        </m.span>
        <HeadlineReveal
          text="Flip through anything."
          className="font-display mt-6 text-6xl font-semibold leading-[1.0] tracking-[-0.02em] sm:text-7xl lg:text-[5.5rem]"
        />
        <m.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mx-auto mt-6 max-w-xl text-xl leading-8 text-[var(--qlico-muted)]"
        >
          QLICO turns static PDFs into interactive editions — with hotspots, analytics, and
          one-line embeds. Built for catalogs, lookbooks, portfolios, and reports.
        </m.p>
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.65, duration: 0.6 }}
          className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row"
        >
          <MagneticButton
            href="/login"
            onClick={() => track('cta_click', { cta: 'start_free', location: 'hero' })}
            className="w-full rounded-full bg-[var(--accent)] px-7 py-3.5 text-center text-[15px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(60,35,132,0.6)] transition-colors hover:bg-[var(--accent-hover)] sm:w-auto"
          >
            Start for free
          </MagneticButton>
          <Link
            href="/book/demo"
            onClick={() => track('cta_click', { cta: 'view_demo', location: 'hero' })}
            className="text-[15px] font-medium text-[var(--accent)] transition hover:underline"
          >
            View the demo →
          </Link>
        </m.div>
      </div>

      <ProductShot />
    </section>
  )
}
