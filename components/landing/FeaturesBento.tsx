'use client'

import React from 'react'
import {
  BarChart2,
  BookOpen,
  Code2,
  Palette,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react'
import { m, useReducedMotion, useScroll, useTransform } from 'framer-motion'
import Reveal from './Reveal'

/** Clean, Apple-grade bento card wrapper. */
function BentoCard({ children, className, highlight = false }: { children: React.ReactNode, className?: string, highlight?: boolean }) {
  return (
    <div
      className={`group relative flex h-full flex-col overflow-hidden rounded-3xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)] shadow-sm transition-all duration-500 ease-out hover:-translate-y-1.5 hover:shadow-[0_32px_64px_-12px_rgba(20,26,58,0.1)] ${className || ''}`}
    >
      {highlight && (
        <>
          {/* Rotating gradient background for the border */}
          <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
             <m.div
               animate={{ rotate: 360 }}
               transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
               className="absolute -inset-[100%] z-0 opacity-80"
               style={{
                 background: 'conic-gradient(from 0deg, transparent 0 340deg, var(--accent) 360deg)'
               }}
             />
          </div>
          {/* Inner masking to hide everything but the 2px border */}
          <div className="absolute inset-[2px] z-0 rounded-[calc(1.5rem-2px)] bg-[var(--qlico-paper)] pointer-events-none" />
        </>
      )}
      <div className="relative z-10 flex h-full flex-col p-7">
        {children}
      </div>
    </div>
  )
}

/** Tiny animated bar chart for the analytics bento tile. */
function MiniBars() {
  const reduce = useReducedMotion()
  const bars = [38, 62, 48, 80, 56, 95]
  return (
    <div className="flex h-16 items-end gap-1.5">
      {bars.map((h, i) => (
        <m.span
          key={i}
          className="w-full rounded-[2px] bg-[var(--accent)]/85"
          initial={{ height: reduce ? `${h}%` : '8%' }}
          whileInView={{ height: `${h}%` }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ delay: i * 0.06, type: 'spring', stiffness: 120, damping: 16 }}
        />
      ))}
    </div>
  )
}

/** Pulsing hotspot dots for the hotspot bento tile. */
function MiniHotspots() {
  const dots = [
    { x: '22%', y: '34%' },
    { x: '64%', y: '52%' },
    { x: '44%', y: '74%' },
  ]
  return (
    <div className="relative h-16 w-full rounded-lg bg-[var(--qlico-subtle)]">
      {dots.map((d, i) => (
        <span key={i} className="qlico-pulse absolute h-2.5 w-2.5 rounded-full bg-[var(--accent)]" style={{ left: d.x, top: d.y }} />
      ))}
    </div>
  )
}

/** Animated price switch for living editions tile. */
function MiniPrices() {
  const reduce = useReducedMotion()
  return (
    <div className="relative flex h-16 w-full items-center justify-center overflow-hidden rounded-lg bg-[var(--qlico-subtle)]">
      <m.div
        className="font-display text-2xl font-semibold text-[var(--accent-fg)]"
        animate={reduce ? {} : { y: [0, -40], opacity: [1, 0] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
      >
        $19
      </m.div>
      <m.div
        className="font-display absolute text-2xl font-semibold text-[var(--qlico-ink)]"
        initial={{ opacity: 0 }}
        animate={reduce ? { opacity: 1 } : { y: [40, 0], opacity: [0, 1] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 1 }}
      >
        $12
      </m.div>
    </div>
  )
}

/** Code typing effect for embeds tile. */
function MiniCode() {
  const reduce = useReducedMotion()
  return (
    <div className="relative flex h-16 w-full flex-col justify-center gap-2 overflow-hidden rounded-lg bg-[var(--invert-surface)] p-4 text-[11px] font-mono text-[var(--invert-muted)]">
      <m.div 
        className="text-[var(--accent-fg)]"
        initial={{ width: reduce ? '100%' : '0%' }}
        whileInView={{ width: '100%' }}
        viewport={{ once: true, amount: 0.8 }}
        transition={{ duration: 1.5, ease: "linear" }}
        style={{ whiteSpace: 'nowrap', overflow: 'hidden' }}
      >
        &lt;iframe src="qlico.app"&gt;
      </m.div>
      <div className="h-1.5 w-1/2 rounded-full bg-[var(--invert-text)] opacity-20"></div>
    </div>
  )
}

/** Animated swatches for made to match tile. */
function MiniSwatches() {
  const reduce = useReducedMotion()
  const colors = ['var(--qlico-ink)', 'var(--accent)', '#00d0ff']
  return (
    <div className="relative flex h-16 w-full items-center gap-3 rounded-lg bg-[var(--qlico-subtle)] px-6">
      {colors.map((c, i) => (
        <m.div
          key={i}
          className="h-6 w-6 rounded-full shadow-sm"
          style={{ backgroundColor: c }}
          animate={reduce ? {} : { scale: [1, 1.2, 1], y: [0, -3, 0] }}
          transition={{ duration: 0.6, delay: i * 0.2, repeat: Infinity, repeatDelay: 3 }}
        />
      ))}
      <div className="ml-auto flex flex-col gap-1.5">
        <div className="h-1.5 w-16 rounded-full bg-[var(--qlico-ink)] opacity-10"></div>
        <div className="h-1.5 w-10 rounded-full bg-[var(--qlico-ink)] opacity-10"></div>
      </div>
    </div>
  )
}

/** Page turn visual for tactile reader tile. */
function MiniPages() {
  const reduce = useReducedMotion()
  return (
    <div className="relative flex h-16 w-full items-center rounded-lg bg-[var(--qlico-subtle)]" style={{ perspective: 800 }}>
       <div className="absolute left-1/2 h-20 w-16 -translate-x-full rounded-l-sm border-y border-l border-[var(--qlico-border)] bg-white shadow-sm" />
       <div className="absolute left-1/2 h-20 w-16 rounded-r-sm border-y border-r border-[var(--qlico-border)] bg-white shadow-sm" />
       <m.div 
         className="absolute left-1/2 h-20 w-16 origin-left rounded-r-sm border-y border-r border-[var(--qlico-border)] bg-gradient-to-r from-white to-[#fafafa] shadow-md"
         animate={reduce ? {} : { rotateY: [0, -180] }}
         transition={{ duration: 2, repeat: Infinity, repeatDelay: 0.5, ease: "easeInOut" }}
         style={{ transformStyle: 'preserve-3d' }}
       />
    </div>
  )
}

type Tile = {
  icon: typeof BookOpen
  title: string
  desc: string
  span: string
  visual?: 'bars' | 'hotspots' | 'prices' | 'code' | 'swatches' | 'pages'
}

const TILES: Tile[] = [
  { icon: BookOpen, title: 'Tactile reader', desc: 'A fluid page-turn that feels like a printed object — riffle the fore-edge to fly anywhere.', span: 'lg:col-span-2', visual: 'pages' },
  { icon: ShoppingBag, title: 'Shoppable hotspots', desc: 'Pin products onto the page — readers check out without leaving.', span: 'lg:col-span-1', visual: 'hotspots' },
  { icon: BarChart2, title: 'Reader analytics', desc: 'Opens, dwell time, completion — in your own data layer.', span: 'lg:col-span-1', visual: 'bars' },
  { icon: RefreshCw, title: 'Living editions', desc: 'Bind prices, stock, and dates. Publish once; it stays current.', span: 'lg:col-span-1', visual: 'prices' },
  { icon: Code2, title: 'One-line embeds', desc: 'Drop a responsive edition into any site, store, or CMS.', span: 'lg:col-span-1', visual: 'code' },
  { icon: Palette, title: 'Made to match', desc: 'Your theme, your fonts, your cover — and no QLICO badge on paid plans.', span: 'lg:col-span-2', visual: 'swatches' },
]

export function FeaturesBento() {
  const containerRef = React.useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start end', 'end start'],
  })

  // We stagger the columns with different scroll speeds to create a deep parallax effect
  const yDown = useTransform(scrollYProgress, [0, 1], [-30, 30])
  const yUp = useTransform(scrollYProgress, [0, 1], [30, -30])
  const yNeutral = useTransform(scrollYProgress, [0, 1], [0, 0])

  return (
    <section id="features" ref={containerRef} className="px-5 py-32 sm:py-48 overflow-hidden">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-20 max-w-2xl text-center">
          <span className="mx-auto mb-6 block h-10 w-[3px] rounded-full bg-[var(--accent)]" />
          <h2 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl lg:text-6xl text-[var(--qlico-ink)]">Everything a page can be.</h2>
          <p className="mt-5 text-lg leading-8 text-[var(--qlico-muted)] max-w-xl mx-auto">
            A precise studio, a frictionless reader, and the deep intelligence in between.
          </p>
        </Reveal>
        
        {/* Asymmetrical 3-column grid */}
        <div className="grid auto-rows-fr grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TILES.map(({ icon: Icon, title, desc, span, visual }, i) => {
            // Apply different parallax directions depending on column to break the grid
            const y = i % 3 === 0 ? yUp : i % 3 === 1 ? yDown : yNeutral
            const highlight = visual === 'bars'

            return (
              <Reveal key={title} delay={0} className={`${span} h-full`}>
                <m.div style={{ y }} className="h-full w-full">
                  <BentoCard highlight={highlight}>
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--qlico-subtle)] text-[var(--qlico-ink)] transition-colors duration-300 group-hover:bg-[var(--invert-surface)] group-hover:text-[var(--invert-text)]">
                      <Icon size={20} strokeWidth={1.75} />
                    </div>
                    <h3 className="mt-6 text-xl font-semibold tracking-[-0.01em] text-[var(--qlico-ink)]">{title}</h3>
                    <p className="mt-2 text-[15px] leading-7 text-[var(--qlico-muted)]">{desc}</p>
                    {visual === 'bars' && <div className="mt-auto pt-8"><MiniBars /></div>}
                    {visual === 'hotspots' && <div className="mt-auto pt-8"><MiniHotspots /></div>}
                    {visual === 'prices' && <div className="mt-auto pt-8"><MiniPrices /></div>}
                    {visual === 'code' && <div className="mt-auto pt-8"><MiniCode /></div>}
                    {visual === 'swatches' && <div className="mt-auto pt-8"><MiniSwatches /></div>}
                    {visual === 'pages' && <div className="mt-auto pt-8"><MiniPages /></div>}
                  </BentoCard>
                </m.div>
              </Reveal>
            )
          })}
        </div>
      </div>
    </section>
  )
}
