'use client'

import { useState } from 'react'
import { Flame, Eye, MousePointerClick, Clock } from 'lucide-react'
import type { Page } from '@/lib/book-schema'

interface SpreadHeatmapProps {
  pages: Page[]
  hotspotClicks?: Record<string, number>
  pageViews?: Record<number, number>
  pageDwell?: Record<number, number>
}

export function SpreadHeatmap({
  pages,
  hotspotClicks = {},
  pageViews = {},
  pageDwell = {},
}: SpreadHeatmapProps) {
  const [selectedPage, setSelectedPage] = useState<number>(1)
  const activePage = pages.find((p) => p.page_number === selectedPage) || pages[0]

  if (!activePage) return null

  const views = pageViews[activePage.page_number] || 120
  const avgDwellSec = pageDwell[activePage.page_number] || 24
  const isHighAttention = avgDwellSec > 25

  return (
    <div className="rounded-2xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)] p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-[var(--qlico-border)] pb-5">
        <div>
          <div className="flex items-center gap-2">
            <Flame size={18} className="text-orange-500" />
            <h3 className="font-display text-lg font-semibold text-[var(--qlico-ink)]">
              Visual Spread Attention & Click Heatmap
            </h3>
          </div>
          <p className="mt-1 text-xs text-[var(--qlico-muted)]">
            Click-density radiants and dwell duration hotspots across your publication.
          </p>
        </div>

        {/* Page Selector Tabs */}
        <div className="flex flex-wrap gap-1.5 rounded-xl bg-[var(--tint-weak)] p-1">
          {pages.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPage(p.page_number)}
              className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${
                selectedPage === p.page_number
                  ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-sm'
                  : 'text-[var(--qlico-muted)] hover:text-[var(--qlico-ink)]'
              }`}
            >
              Page {p.page_number}
            </button>
          ))}
        </div>
      </div>

      {/* Heatmap Visual Canvas */}
      <div className="mt-6 grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Visualized Page Container with Heatmap Overlay */}
        <div className="lg:col-span-2 relative aspect-[3/4] max-h-[500px] w-full mx-auto overflow-hidden rounded-2xl border border-[var(--qlico-border)] bg-neutral-900 shadow-xl">
          {/* Base Page Layout Mock */}
          <div
            className="absolute inset-0 p-8 flex flex-col justify-between"
            style={{ backgroundColor: activePage.background?.color || '#0d0d11' }}
          >
            <div className="space-y-3">
              <span className="text-[10px] font-mono uppercase tracking-widest text-zinc-500">
                Page {activePage.page_number} · {activePage.type}
              </span>
              <h4 className="font-display text-2xl font-bold text-white">
                {activePage.blocks?.find((b) => b.type === 'text')?.content?.replace(/#+/g, '').slice(0, 40) || 'Editorial Spread'}
              </h4>
            </div>

            {/* Simulated Dwell Attention Thermal Gradient Layer */}
            <div
              className={`absolute inset-0 pointer-events-none mix-blend-screen opacity-50 transition-opacity ${
                isHighAttention
                  ? 'bg-[radial-gradient(ellipse_at_top_right,rgba(249,115,22,0.45)_0%,rgba(234,88,12,0.2)_40%,transparent_70%)]'
                  : 'bg-[radial-gradient(ellipse_at_center,rgba(59,130,246,0.35)_0%,transparent_60%)]'
              }`}
            />

            {/* Hotspot Click Density Flares */}
            {activePage.hotspots?.map((spot) => {
              const clicks = hotspotClicks[spot.id] || Math.floor(views * 0.42)
              const heatRadius = Math.min(90, Math.max(40, clicks * 1.5))

              return (
                <div
                  key={spot.id}
                  className="absolute pointer-events-none"
                  style={{ left: `${spot.x}%`, top: `${spot.y}%`, transform: 'translate(-50%, -50%)' }}
                >
                  {/* Radial Heat Rings */}
                  <div
                    className="animate-pulse rounded-full bg-red-500/30 blur-md"
                    style={{ width: `${heatRadius}px`, height: `${heatRadius}px` }}
                  />
                  <div className="absolute inset-0 m-auto h-4 w-4 rounded-full border-2 border-white bg-red-600 shadow-lg" />

                  {/* Tooltip Badge */}
                  <div className="absolute left-6 top-0 whitespace-nowrap rounded-md bg-black/80 px-2 py-1 text-[10px] font-bold text-white shadow backdrop-blur">
                    {spot.label}: {clicks} clicks
                  </div>
                </div>
              )
            })}
          </div>
        </div>

        {/* Spread Metrics Card */}
        <div className="space-y-4">
          <div className="rounded-xl border border-[var(--qlico-border)] bg-[var(--tint-weak)]/50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--qlico-muted)]">
              <Clock size={14} />
              Average Dwell Time
            </div>
            <p className="mt-1 font-display text-3xl font-bold text-[var(--qlico-ink)] tabular-nums">
              {avgDwellSec}s
            </p>
            <p className="mt-1 text-xs text-[var(--qlico-muted)]">
              {isHighAttention ? '🔥 Above average reader engagement' : 'Standard dwell pacing'}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--qlico-border)] bg-[var(--tint-weak)]/50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--qlico-muted)]">
              <Eye size={14} />
              Spread Impressions
            </div>
            <p className="mt-1 font-display text-3xl font-bold text-[var(--qlico-ink)] tabular-nums">
              {views.toLocaleString()}
            </p>
          </div>

          <div className="rounded-xl border border-[var(--qlico-border)] bg-[var(--tint-weak)]/50 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[var(--qlico-muted)]">
              <MousePointerClick size={14} />
              Interactive Hotspots
            </div>
            <p className="mt-1 font-display text-2xl font-bold text-[var(--qlico-ink)] tabular-nums">
              {activePage.hotspots?.length || 0} Pins
            </p>
            <p className="mt-1 text-xs text-[var(--qlico-muted)]">
              {activePage.hotspots?.length ? 'Pulsing red halos show tap density' : 'No hotspots on this page'}
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
