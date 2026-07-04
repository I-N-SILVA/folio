'use client'

import {
  BarChart2,
  BookOpen,
  Code2,
  Palette,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react'
import { m, useReducedMotion } from 'framer-motion'
import Reveal from './Reveal'

/** Tiny animated bar chart for the analytics bento tile. */
function MiniBars() {
  const reduce = useReducedMotion()
  const bars = [38, 62, 48, 80, 56, 95]
  return (
    <div className="flex h-16 items-end gap-1.5">
      {bars.map((h, i) => (
        <m.span
          key={i}
          className="w-full rounded-sm bg-[var(--accent)]/85"
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

type Tile = {
  icon: typeof BookOpen
  title: string
  desc: string
  span: string
  visual?: 'bars' | 'hotspots'
}

const TILES: Tile[] = [
  { icon: BookOpen, title: 'Tactile reader', desc: 'A fluid page-turn that feels like a printed object — riffle the fore-edge to fly anywhere.', span: 'lg:col-span-2' },
  { icon: ShoppingBag, title: 'Shoppable hotspots', desc: 'Pin products onto the page — readers check out without leaving.', span: 'lg:col-span-1', visual: 'hotspots' },
  { icon: BarChart2, title: 'Reader analytics', desc: 'Opens, dwell time, completion — in your own data layer.', span: 'lg:col-span-1', visual: 'bars' },
  { icon: RefreshCw, title: 'Living editions', desc: 'Bind prices, stock, and dates. Publish once; it stays current.', span: 'lg:col-span-1' },
  { icon: Code2, title: 'One-line embeds', desc: 'Drop a responsive edition into any site, store, or CMS.', span: 'lg:col-span-1' },
  { icon: Palette, title: 'Made to match', desc: 'Themes, custom domains, and no watermark on paid plans.', span: 'lg:col-span-2' },
]

export function FeaturesBento() {
  return (
    <section id="features" className="px-5 py-28">
      <div className="mx-auto max-w-6xl">
        <Reveal className="mx-auto mb-14 max-w-2xl text-center">
          <span className="mx-auto mb-5 block h-9 w-[3px] rounded-full bg-[var(--accent)]" />
          <h2 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">Everything a page can be.</h2>
          <p className="mt-4 text-lg leading-8 text-[var(--qlico-muted)]">
            A studio, a reader, and the intelligence in between.
          </p>
        </Reveal>
        <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {TILES.map(({ icon: Icon, title, desc, span, visual }, i) => (
            <Reveal key={title} delay={(i % 4) * 70} className={span}>
              <div className="group flex h-full flex-col rounded-3xl border border-[var(--qlico-border)] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
                <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--qlico-subtle)] text-[var(--qlico-ink)] transition-colors duration-300 group-hover:bg-[var(--qlico-ink)] group-hover:text-white">
                  <Icon size={20} strokeWidth={1.75} />
                </div>
                <h3 className="mt-5 text-lg font-semibold tracking-[-0.01em]">{title}</h3>
                <p className="mt-2 text-[15px] leading-7 text-[var(--qlico-muted)]">{desc}</p>
                {visual === 'bars' && <div className="mt-auto pt-6"><MiniBars /></div>}
                {visual === 'hotspots' && <div className="mt-auto pt-6"><MiniHotspots /></div>}
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
