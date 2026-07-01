'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts'
import { ArrowLeft, Download, BookOpen, Users, CheckCircle, Clock } from 'lucide-react'
import Reveal from '@/components/landing/Reveal'
import { NumberTicker } from '@/components/landing/NumberTicker'

type DateRange = '7d' | '30d' | '90d' | 'all'

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
  raw: any[]
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

export function AnalyticsDashboard({ book }: { book: any }) {
  const [range, setRange] = useState<DateRange>('30d')
  const [data, setData] = useState<AnalyticsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [heatmapPage, setHeatmapPage] = useState<number>(1)

  useEffect(() => {
    setLoading(true)
    fetch(`/api/analytics/${book.slug}?range=${range}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [book.slug, range])

  function downloadCSV() {
    if (!data?.raw) return
    const headers = ['id', 'book_id', 'session_id', 'event_type', 'page_number', 'payload', 'created_at']
    const rows = data.raw.map((e) =>
      headers.map((h) => {
        const v = e[h]
        return typeof v === 'object' ? JSON.stringify(v) : String(v ?? '')
      }).join(',')
    )
    const csv = [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${book.slug}-events.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  const ranges: { label: string; value: DateRange }[] = [
    { label: '7d', value: '7d' },
    { label: '30d', value: '30d' },
    { label: '90d', value: '90d' },
    { label: 'All time', value: 'all' },
  ]

  return (
    <main className="min-h-screen bg-[var(--background)] p-6 text-[var(--folio-ink)]">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-[var(--folio-muted)] transition-colors hover:text-[var(--folio-ink)]">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--accent)]">Analytics</p>
              <h1 className="font-display text-3xl font-semibold tracking-[-0.02em]">{book.title}</h1>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date range filter */}
            <div className="flex rounded-full border border-[var(--folio-border)] bg-white p-0.5">
              {ranges.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition-colors ${
                    range === r.value ? 'bg-[var(--accent)] text-white' : 'text-[var(--folio-muted)] hover:text-[var(--folio-ink)]'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 rounded-full border border-[var(--folio-border)] bg-white px-4 py-2 text-sm font-semibold text-[var(--folio-ink)] transition-colors hover:bg-black/5"
            >
              <Download size={14} />
              CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-[var(--folio-muted)]">Loading analytics…</div>
        ) : !data ? (
          <div className="text-center py-20 text-[var(--folio-muted)]">Failed to load analytics.</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard icon={<BookOpen size={18} className="text-[var(--accent)]" />} label="Total Opens" delay={0}>
                <NumberTicker value={data.summary.totalOpens} />
              </StatCard>
              <StatCard icon={<Users size={18} className="text-[var(--accent)]" />} label="Unique Sessions" delay={70}>
                <NumberTicker value={data.summary.uniqueSessions} />
              </StatCard>
              <StatCard icon={<CheckCircle size={18} className="text-[var(--accent)]" />} label="Completion Rate" delay={140}>
                <NumberTicker value={data.summary.completionRate} suffix="%" />
              </StatCard>
              <StatCard icon={<Clock size={18} className="text-[var(--accent)]" />} label="Avg Session" delay={210}>
                {formatDuration(data.summary.avgSessionMs)}
              </StatCard>
            </div>

            {/* Page View Heatmap */}
            {data.pageViewData.length > 0 && (
              <ChartCard title="Page Views">
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
                <p className="text-xs text-[var(--folio-muted)] text-center mt-1">Color: green = long dwell · red = quick skip</p>
              </ChartCard>
            )}

            {/* Completion Funnel */}
            {data.funnelData.length > 0 && (
              <ChartCard title="Session Completion Funnel">
                <ResponsiveContainer width="100%" height={220}>
                  <BarChart data={data.funnelData} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
                    <XAxis dataKey="page" tick={{ fontSize: 11 }} />
                    <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `${v}%`} />
                    <Tooltip formatter={(val: any) => [`${val}%`, '% Sessions']} />
                    <Bar dataKey="pct" fill="#0066ff" radius={[4, 4, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </ChartCard>
            )}

            {/* Visual Heatmap */}
            {Object.keys(data.heatmapData || {}).length > 0 && (
              <ChartCard title="Click Heatmap">
                <div className="flex gap-4 items-start">
                  <div className="flex flex-col gap-2 w-24 shrink-0">
                    <span className="text-xs text-[var(--folio-muted)] font-medium uppercase tracking-wider">Page</span>
                    {Object.keys(data.heatmapData)
                      .map(Number)
                      .sort((a, b) => a - b)
                      .map((p) => (
                        <button
                          key={p}
                          onClick={() => setHeatmapPage(p)}
                          className={`text-sm py-1.5 px-3 rounded-lg text-left transition-colors ${
                            heatmapPage === p ? 'bg-[#0066ff] text-white' : 'hover:bg-black/5 text-[var(--folio-ink)]'
                          }`}
                        >
                          Page {p}
                        </button>
                      ))}
                  </div>
                  <div className="flex-1 bg-[var(--folio-subtle)] rounded-xl overflow-hidden aspect-[1/1.41] relative shadow-inner max-w-sm mx-auto">
                    {/* Placeholder for the page background, eventually could load the actual page image */}
                    <div className="absolute inset-0 bg-white"></div>
                    {data.heatmapData[heatmapPage]?.map((pt, i) => (
                      <div
                        key={i}
                        className="absolute w-4 h-4 -ml-2 -mt-2 rounded-full bg-red-500/40 mix-blend-multiply blur-[2px]"
                        style={{ left: `${pt.x}%`, top: `${pt.y}%` }}
                      />
                    ))}
                    {(!data.heatmapData[heatmapPage] || data.heatmapData[heatmapPage].length === 0) && (
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-[var(--folio-muted)]">
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
                      <tr className="text-left text-[var(--folio-muted)] text-xs border-b border-[var(--folio-border)]">
                        <th className="pb-2 font-medium">Hotspot ID</th>
                        <th className="pb-2 font-medium text-right">Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topHotspots.map((h) => (
                        <tr key={h.id} className="border-b border-[var(--folio-hairline)]">
                          <td className="py-2 font-mono text-xs text-[var(--folio-muted)] truncate max-w-[180px]">{h.id}</td>
                          <td className="py-2 text-right font-medium">{h.count}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableCard>
              )}

              {/* CTA Clicks */}
              {data.ctaData.length > 0 && (
                <TableCard title="CTA Button Clicks">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="text-left text-[var(--folio-muted)] text-xs border-b border-[var(--folio-border)]">
                        <th className="pb-2 font-medium">Block / Page</th>
                        <th className="pb-2 font-medium text-right">Clicks</th>
                        <th className="pb-2 font-medium text-right">Unique</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ctaData.map((c) => (
                        <tr key={c.id} className="border-b border-[var(--folio-hairline)]">
                          <td className="py-2">
                            <span className="font-mono text-xs text-[var(--folio-muted)] truncate">{c.id}</span>
                            {c.page && <span className="text-xs text-[var(--folio-muted)] ml-1">p.{c.page}</span>}
                          </td>
                          <td className="py-2 text-right font-medium">{c.clicks}</td>
                          <td className="py-2 text-right text-[var(--folio-muted)]">{c.uniqueClicks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableCard>
              )}

              {/* Captured Leads */}
              {data.leadData && data.leadData.length > 0 && (
                <TableCard title="Captured Leads (Gate Unlocks)">
                  <div className="max-h-64 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="sticky top-0 bg-white">
                        <tr className="text-left text-[var(--folio-muted)] text-xs border-b border-[var(--folio-border)]">
                          <th className="pb-2 font-medium">Email</th>
                          <th className="pb-2 font-medium text-right">Captured On</th>
                        </tr>
                      </thead>
                      <tbody>
                        {data.leadData.map((lead, idx) => (
                          <tr key={idx} className="border-b border-[var(--folio-hairline)]">
                            <td className="py-2 font-medium">{lead.email}</td>
                            <td className="py-2 text-right text-xs text-[var(--folio-muted)]">
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

            {data.pageViewData.length === 0 && data.topHotspots.length === 0 && (
              <div className="rounded-3xl border border-[var(--folio-border)] bg-white py-16 text-center">
                <p className="text-[var(--folio-muted)]">No analytics data yet for this period.</p>
                <p className="mt-1 text-sm text-[var(--folio-muted)]">Share your edition to start collecting data.</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
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
      <div className="rounded-3xl border border-[var(--folio-border)] bg-white p-5 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-[0_18px_44px_rgba(0,0,0,0.07)]">
        <div className="mb-3 flex items-center gap-2">
          {icon}
          <span className="text-xs font-medium uppercase tracking-[0.12em] text-[var(--folio-muted)]">{label}</span>
        </div>
        <p className="font-display text-4xl font-semibold tracking-[-0.03em] text-[var(--folio-ink)]">{children}</p>
      </div>
    </Reveal>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <div className="rounded-3xl border border-[var(--folio-border)] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold tracking-[-0.01em] text-[var(--folio-ink)]">{title}</h2>
        {children}
      </div>
    </Reveal>
  )
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Reveal>
      <div className="h-full rounded-3xl border border-[var(--folio-border)] bg-white p-6">
        <h2 className="mb-4 text-sm font-semibold tracking-[-0.01em] text-[var(--folio-ink)]">{title}</h2>
        {children}
      </div>
    </Reveal>
  )
}
