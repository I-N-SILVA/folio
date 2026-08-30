'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { ArrowLeft, Download, BookOpen, Users, CheckCircle, Clock, Lock } from 'lucide-react'
import Reveal from '@/components/landing/Reveal'
import { NumberTicker } from '@/components/landing/NumberTicker'
import { PageRenderer } from '@/components/viewer/PageRenderer'
import { SpreadHeatmap } from './SpreadHeatmap'
import type { Book } from '@/lib/book-schema'

type DateRange = '7d' | '30d' | '90d' | '365d'

interface AnalyticsData {
  summary: {
    totalOpens: number
    uniqueSessions: number
    completionRate: number
    avgSessionMs: number
  }
  pageViewData: Array<{ page: number; views: number; avgDwellMs: number }>
  funnelData: Array<{ page: number; sessions: number; pct: number }>
  topHotspots: Array<{ id: string; count: number }>
  ctaData: Array<{ id: string; href?: string; page?: number; clicks: number; uniqueClicks: number }>
  heatmapData: Record<number, Array<{ x: number; y: number }>>
  leadData: Array<{ email: string; timestamp: string; page: number }>
  gate?: { views: number; unlocks: number; rate: number }
  /** What the server actually queried, which is not always what was asked for. */
  window?: { days: number; limitDays: number; clamped: boolean }
  csvExport?: boolean
}

function formatDuration(ms: number) {
  if (ms === 0) return '0s'
  if (!ms) return '—'
  const s = Math.round(ms / 1000)
  if (s < 60) return `${s}s`
  return `${Math.floor(s / 60)}m ${s % 60}s`
}

function dwellColor(ms: number) {
  if (ms > 20000) return '#22c55e'
  if (ms > 5000) return '#f59e0b'
  return '#ef4444'
}

/**
 * The hotspot and CTA tables listed bare UUIDs, which tell the owner nothing
 * about which pin or button people actually clicked. These map the IDs back
 * onto the labels the owner typed in the editor.
 */
function buildLabelMaps(book: Book) {
  const hotspots = new Map<string, { label: string; page: number }>()
  const blocks = new Map<string, { label: string; page: number }>()

  for (const page of book.pages ?? []) {
    for (const hotspot of page.hotspots ?? []) {
      hotspots.set(hotspot.id, {
        label: hotspot.label || hotspot.modal?.title || 'Untitled hotspot',
        page: page.page_number,
      })
    }
    for (const block of page.blocks ?? []) {
      if (block.type === 'button') {
        blocks.set(block.id, { label: block.label || 'Untitled button', page: page.page_number })
      }
    }
  }

  return { hotspots, blocks }
}

export function AnalyticsDashboard({ book }: { book: Book }) {
  const [range, setRange] = useState<DateRange>('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [heatmapPage, setHeatmapPage] = useState<number>(1)
  const [reloadKey, setReloadKey] = useState(0)
  const [copied, setCopied] = useState(false)

  const published = Boolean(book.settings?.published)
  const [origin, setOrigin] = useState('')
  useEffect(() => setOrigin(window.location.origin), [])
  const liveUrl = `${origin}/book/${book.slug}`

  async function copyLiveUrl() {
    // navigator.clipboard is undefined on insecure origins and in some in-app
    // browsers, so an unguarded call there throws and appears to do nothing.
    try {
      if (!navigator.clipboard) throw new Error('unavailable')
      await navigator.clipboard.writeText(liveUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      /* the field is selectable — the reader can copy it by hand */
    }
  }

  const labels = useMemo(() => buildLabelMaps(book), [book])
  const pageByNumber = useMemo(
    () => new Map((book.pages ?? []).map((p) => [p.page_number, p])),
    [book]
  )

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics/${book.slug}?range=${range}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => { setData(null); setLoading(false) })
  }, [book.slug, range, reloadKey])

  // Export is a server route now — the browser no longer receives every event
  // row just so it can build a CSV, and the paid `csvExport` entitlement is
  // checked somewhere the client can't skip.
  function exportUrl(kind: 'events' | 'leads') {
    const days = data?.window?.days ?? 30
    return `/api/analytics/${book.slug}/export?kind=${kind}&days=${days}`
  }

  const canExport = data?.csvExport !== false

  const ranges: { label: string; value: DateRange }[] = [
    { label: '7d', value: '7d' },
    { label: '30d', value: '30d' },
    { label: '90d', value: '90d' },
    { label: '12m', value: '365d' },
  ]

  return (
    <main className="min-h-screen bg-[var(--background)] p-6 text-[var(--qlico-ink)]">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-[var(--qlico-muted)] transition-colors hover:text-[var(--qlico-ink)]">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent-fg)]">Analytics</p>
              <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">{book.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date range filter */}
            <div className="flex rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)] p-0.5">
              {ranges.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    range === r.value ? 'bg-[var(--accent)] text-[var(--accent-contrast)]' : 'text-[var(--qlico-muted)] hover:text-[var(--qlico-ink)]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            {canExport ? (
              <a
                href={exportUrl('events')}
                className="flex items-center gap-1.5 rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)] px-4 py-2 text-sm font-semibold text-[var(--qlico-ink)] transition-colors hover:bg-[var(--tint-weak)]"
              >
                <Download size={14} />
                CSV
              </a>
            ) : (
              <Link
                href="/account"
                title="CSV export is available on paid plans"
                className="flex items-center gap-1.5 rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)] px-4 py-2 text-sm font-semibold text-[var(--qlico-muted)] transition-colors hover:bg-[var(--tint-weak)]"
              >
                <Lock size={13} />
                CSV
              </Link>
            )}
          </div>
        </div>

        {loading ? (
          <AnalyticsSkeleton />
        ) : !data ? (
          <div className="rounded-3xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)] py-16 text-center">
            <p className="font-semibold text-[var(--qlico-ink)]">Couldn&apos;t load analytics</p>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--qlico-muted)]">
              The request didn&apos;t come back. Check your connection and try again.
            </p>
            <button
              onClick={() => setReloadKey((k) => k + 1)}
              className="mt-5 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
            >
              Retry
            </button>
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={<BookOpen size={18} className="text-[var(--accent-fg)]" />} label="Total Opens" delay={0}>
                <NumberTicker value={data.summary.totalOpens} />
              </StatCard>
              <StatCard icon={<Users size={18} className="text-[var(--accent-fg)]" />} label="Unique Sessions" delay={70}>
                <NumberTicker value={data.summary.uniqueSessions} />
              </StatCard>
              <StatCard icon={<CheckCircle size={18} className="text-[var(--accent-fg)]" />} label="Completion Rate" delay={140}>
                <NumberTicker value={data.summary.completionRate} suffix="%" />
              </StatCard>
              <StatCard icon={<Clock size={18} className="text-[var(--accent-fg)]" />} label="Avg Session" delay={210}>
                {formatDuration(data.summary.avgSessionMs)}
              </StatCard>
            </div>

            {/* Gate funnel — only meaningful for a gated edition. */}
            {data.gate && data.gate.views > 0 && (
              <Reveal>
                <div className="grid gap-4 rounded-3xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)] p-6 sm:grid-cols-3">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--qlico-muted)]">
                      Reached the gate
                    </p>
                    <p className="font-display mt-1 text-3xl font-semibold tracking-[-0.03em]">
                      <NumberTicker value={data.gate.views} />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--qlico-muted)]">
                      Gave an email
                    </p>
                    <p className="font-display mt-1 text-3xl font-semibold tracking-[-0.03em]">
                      <NumberTicker value={data.gate.unlocks} />
                    </p>
                  </div>
                  <div>
                    <p className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--qlico-muted)]">
                      Conversion
                    </p>
                    <p className="font-display mt-1 text-3xl font-semibold tracking-[-0.03em] text-[var(--accent-fg)]">
                      <NumberTicker value={data.gate.rate} suffix="%" />
                    </p>
                  </div>
                </div>
              </Reveal>
            )}

            {/* Page View Heatmap */}
            {data.pageViewData.length > 0 && (
              <ChartCard
                title="Page Views"
                summary={`Views per page. ${data.pageViewData
                  .map(
                    (d) =>
                      `Page ${d.page}: ${d.views} view${d.views === 1 ? '' : 's'}, average dwell ${formatDuration(d.avgDwellMs)}.`
                  )
                  .join(' ')}`}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.pageViewData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <XAxis dataKey="page" tick={{ fontSize: 11 }} label={{ value: 'Page', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} />
                    <Tooltip
                      formatter={(val: any, name?: any) =>
                        name === 'views' ? [val, 'Views'] : [formatDuration(val as number), 'Avg Dwell']
                      }
                    />
                    <Bar dataKey="views" radius={[4, 4, 0, 0]}>
                      {data.pageViewData.map((entry) => (
                        <Cell key={entry.page} fill={dwellColor(entry.avgDwellMs)} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
                <p className="text-xs text-[var(--qlico-muted)] text-center mt-1">Color: green = long dwell · red = quick skip</p>
              </ChartCard>
            )}

            {/* Completion Funnel */}
            {data.funnelData.length > 0 && (
              <ChartCard
                title="Session Completion Funnel"
                summary={`Share of sessions reaching each page. ${data.funnelData
                  .map((d) => `Page ${d.page}: ${d.pct}%.`)
                  .join(' ')}`}
              >
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.funnelData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <XAxis dataKey="page" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(val: any) => [`${val}%`, '% Sessions']} />
                    <Bar dataKey="pct" fill="var(--accent)" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Visual Heatmap */}
            {Object.keys(data.heatmapData || {}).length > 0 && (
              <ChartCard title="Click Heatmap">
                <div className="flex gap-4 items-start">
                  <div className="flex flex-col gap-2 w-24 shrink-0">
                    <span className="text-xs text-[var(--qlico-muted)] font-medium uppercase tracking-wider">Page</span>
                    {Object.keys(data.heatmapData)
                      .map(Number)
                      .sort((a, b) => a - b)
                      .map((p) => (
                        <button
                          key={p}
                          onClick={() => setHeatmapPage(p)}
                          className={`text-sm py-1.5 px-3 rounded-lg text-left transition-colors ${
                            heatmapPage === p ? 'bg-[var(--accent)] text-[var(--accent-contrast)]' : 'hover:bg-[var(--tint-weak)] text-[var(--qlico-ink)]'
                          }`}
                        >
                          Page {p}
                        </button>
                      ))}
                  </div>
                  <div className="relative mx-auto aspect-[1/1.41] max-w-sm flex-1 overflow-hidden rounded-xl bg-[var(--qlico-paper)] shadow-inner">
                    {/* Dots over a blank rectangle said nothing about *what*
                        was clicked. Rendering the real page puts every click
                        back in context. */}
                    {pageByNumber.get(heatmapPage) ? (
                      <div className="pointer-events-none absolute inset-0">
                        <PageRenderer
                          page={pageByNumber.get(heatmapPage)!}
                          bookId={book.id}
                          theme={book.theme}
                          className="h-full w-full"
                        />
                      </div>
                    ) : (
                      <div className="absolute inset-0 bg-[var(--qlico-paper)]" />
                    )}
                    <div className="absolute inset-0 bg-[var(--qlico-paper)]/45" />
                    {data.heatmapData[heatmapPage]?.map((pt, i) => (
                      <div
                        key={i}
                        className="absolute -ml-2 -mt-2 h-4 w-4 rounded-full bg-red-500/40 blur-[2px] mix-blend-multiply"
                        style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                      />
                    ))}
                    {(!data.heatmapData[heatmapPage] || data.heatmapData[heatmapPage].length === 0) && (
                      <div className="absolute inset-0 flex items-center justify-center bg-[var(--qlico-paper)]/70 text-sm text-[var(--qlico-muted)]">
                        No clicks recorded on this page
                      </div>
                    )}
                  </div>
                </div>
              </ChartCard>
            )}

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              {/* Top Hotspots */}
              {data.topHotspots.length > 0 && (
                <TableCard title="Top Hotspot Clicks">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--qlico-muted)] text-xs border-b border-[var(--qlico-border)]">
                        <th className="pb-2 font-medium">Hotspot</th>
                        <th className="pb-2 font-medium text-right">Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topHotspots.map((h) => {
                        const match = labels.hotspots.get(h.id)
                        return (
                          <tr key={h.id} className="border-b border-[var(--qlico-hairline)]">
                            <td className="max-w-[220px] py-2">
                              <span className="block truncate font-medium">
                                {match?.label ?? 'Deleted hotspot'}
                              </span>
                              <span className="text-xs text-[var(--qlico-muted)]">
                                {match ? `Page ${match.page}` : h.id}
                              </span>
                            </td>
                            <td className="py-2 text-right font-medium">{h.count}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </TableCard>
              )}

              {/* CTA Clicks */}
              {data.ctaData.length > 0 && (
                <TableCard title="CTA Button Clicks">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--qlico-muted)] text-xs border-b border-[var(--qlico-border)]">
                        <th className="pb-2 font-medium">Button</th>
                        <th className="pb-2 font-medium text-right">Clicks</th>
                        <th className="pb-2 font-medium text-right">Unique</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ctaData.map((c) => {
                        const match = labels.blocks.get(c.id)
                        const page = match?.page ?? c.page
                        return (
                          <tr key={c.id} className="border-b border-[var(--qlico-hairline)]">
                            <td className="max-w-[220px] py-2">
                              <span className="block truncate font-medium">
                                {match?.label ?? 'Deleted button'}
                              </span>
                              <span className="block truncate text-xs text-[var(--qlico-muted)]">
                                {page ? `Page ${page}` : ''}
                                {page && c.href ? ' · ' : ''}
                                {c.href ?? ''}
                              </span>
                            </td>
                            <td className="py-2 text-right font-medium">{c.clicks}</td>
                            <td className="py-2 text-right text-[var(--qlico-muted)]">{c.uniqueClicks}</td>
                          </tr>
                        )
                      })}
                    </tbody>
                  </table>
                </TableCard>
              )}

              {/* Captured Leads */}
              {data.leadData && data.leadData.length > 0 && (
                <TableCard
                  title="Captured Leads (Gate Unlocks)"
                  action={
                    canExport ? (
                      <a
                        href={exportUrl('leads')}
                        className="flex items-center gap-1.5 rounded-full border border-[var(--qlico-border)] px-3 py-1.5 text-xs font-semibold transition-colors hover:bg-[var(--tint-weak)]"
                      >
                        <Download size={12} />
                        Export leads
                      </a>
                    ) : (
                      <Link
                        href="/account"
                        className="flex items-center gap-1.5 rounded-full border border-[var(--qlico-border)] px-3 py-1.5 text-xs font-semibold text-[var(--qlico-muted)] transition-colors hover:bg-[var(--tint-weak)]"
                      >
                        <Lock size={12} />
                        Upgrade to export
                      </Link>
                    )
                  }
                >
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-[var(--qlico-paper)]">
                        <tr className="text-left text-[var(--qlico-muted)] text-xs border-b border-[var(--qlico-border)]">
                          <th className="pb-2 font-medium">Email</th>
                          <th className="pb-2 font-medium text-right">Captured On</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.leadData.map((lead, idx) => (
                          <tr key={idx} className="border-b border-[var(--qlico-hairline)]">
                            <td className="py-2 font-medium">{lead.email}</td>
                            <td className="py-2 text-right text-xs text-[var(--qlico-muted)]">
                              {new Date(lead.timestamp).toLocaleDateString()}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </TableCard>
              )}
            </div>

            {/* Visual Spread Attention Heatmap */}
            {(book.pages?.length ?? 0) > 0 && (
              <div className="mt-8">
                <SpreadHeatmap pages={book.pages ?? []} />
              </div>
            )}

            {/* The most common first view of this screen, and it used to be a
                dead end: two sentences telling the author to share, with nothing
                to share. The link is the thing they need — so hand it over. */}
            {data.pageViewData.length === 0 && data.topHotspots.length === 0 && (
              <div className="rounded-3xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)] px-6 py-14 text-center">
                <p className="font-display text-2xl font-semibold tracking-[-0.03em]">
                  Nobody has opened this edition yet.
                </p>
                <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--qlico-muted)]">
                  {published
                    ? 'Numbers appear here as soon as one person reads it. Copy the link and send it to someone — one reader is enough to see this screen come alive.'
                    : 'This edition is still a draft, so its link is not live yet. Publish it in the editor, then send the link to one person.'}
                </p>

                {published && (
                  <div className="mx-auto mt-6 flex max-w-md flex-col items-center gap-3 sm:flex-row">
                    <input
                      readOnly
                      value={liveUrl}
                      aria-label="Live edition link"
                      onFocus={(e) => e.currentTarget.select()}
                      className="w-full flex-1 rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-subtle)] px-4 py-2.5 text-center font-mono text-xs text-[var(--qlico-ink)] outline-none sm:text-left"
                    />
                    <button
                      onClick={copyLiveUrl}
                      className="w-full shrink-0 rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)] sm:w-auto"
                    >
                      {copied ? 'Copied' : 'Copy link'}
                    </button>
                  </div>
                )}

                {!published && (
                  <Link
                    href={`/editor/${book.id}`}
                    className="mt-6 inline-block rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
                  >
                    Open the editor
                  </Link>
                )}
              </div>
            )}

            {/* Say what window is actually on screen. The range buttons used to
                imply the query honoured them; "all time" never did. */}
            {data.window?.clamped && (
              <p className="text-center text-xs text-[var(--qlico-muted)]">
                Showing the last {data.window.days} days — the longest window your plan keeps.{' '}
                <Link href="/account" className="font-semibold text-[var(--accent-fg)] hover:underline">
                  See plans
                </Link>
              </p>
            )}
          </>
        )}
      </div>
    </main>
  )
}

/**
 * Switching date range dropped the whole dashboard to the words "Loading
 * analytics…", so the layout collapsed and rebuilt on every toggle. Holding
 * the shape steady makes the change feel like a refresh rather than a reload.
 */
function AnalyticsSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true" aria-live="polite">
      <span className="sr-only">Loading analytics…</span>
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className="h-[116px] animate-pulse rounded-3xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)]"
          />
        ))}
      </div>
      {[0, 1].map((i) => (
        <div
          key={i}
          className="h-[300px] animate-pulse rounded-3xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)]"
        />
      ))}
    </div>
  )
}

function StatCard({
  icon,
  label,
  children,
  delay = 0,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
  delay?: number
}) {
  return (
    <Reveal delay={delay}>
      <div className="rounded-3xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)] p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(0,0,0,0.07)]">
        <div className="mb-3 flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--qlico-muted)]">{label}</span>
        </div>
        <p className="font-display text-4xl font-semibold tracking-[-0.03em] text-[var(--qlico-ink)]">{children}</p>
      </div>
    </Reveal>
  )
}

function ChartCard({
  title,
  summary,
  children,
}: {
  title: string
  /**
   * Recharts draws to SVG with no accessible content, so the numbers behind
   * each chart were unavailable to a screen reader. This states them in text.
   */
  summary?: string
  children: React.ReactNode
}) {
  return (
    <Reveal>
      <div className="rounded-3xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)] p-6">
        <h2 className="mb-4 text-sm font-semibold tracking-[-0.01em] text-[var(--qlico-ink)]">{title}</h2>
        {summary && <p className="sr-only">{summary}</p>}
        <div aria-hidden={summary ? 'true' : undefined}>{children}</div>
      </div>
    </Reveal>
  )
}

function TableCard({
  title,
  action,
  children,
}: {
  title: string
  action?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <Reveal>
      <div className="h-full rounded-3xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)] p-6">
        <div className="mb-4 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold tracking-[-0.01em] text-[var(--qlico-ink)]">{title}</h2>
          {action}
        </div>
        {children}
      </div>
    </Reveal>
  )
}
