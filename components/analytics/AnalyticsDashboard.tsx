'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
  FunnelChart, Funnel, LabelList, Cell
} from 'recharts'
import { ArrowLeft, Download, BookOpen, Users, CheckCircle, Clock } from 'lucide-react'

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
    <main className="min-h-screen bg-[#f5f5f7] p-6">
      <div className="max-w-5xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="flex items-center gap-3">
            <Link href="/dashboard" className="text-gray-500 hover:text-gray-800 transition-colors">
              <ArrowLeft size={20} />
            </Link>
            <div>
              <h1 className="text-xl font-bold">{book.title}</h1>
              <p className="text-sm text-gray-500">Analytics</p>
            </div>
          </div>

          <div className="flex items-center gap-3">
            {/* Date range filter */}
            <div className="flex rounded-lg border border-gray-200 overflow-hidden bg-white">
              {ranges.map((r) => (
                <button
                  key={r.value}
                  onClick={() => setRange(r.value)}
                  className={`px-3 py-1.5 text-xs font-medium transition-colors ${
                    range === r.value ? 'bg-[#0066ff] text-white' : 'text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {r.label}
                </button>
              ))}
            </div>

            <button
              onClick={downloadCSV}
              className="flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 border border-gray-200 rounded-lg px-3 py-1.5 bg-white hover:bg-gray-50 transition-colors"
            >
              <Download size={14} />
              CSV
            </button>
          </div>
        </div>

        {loading ? (
          <div className="flex items-center justify-center py-20 text-gray-400">Loading analytics…</div>
        ) : !data ? (
          <div className="text-center py-20 text-gray-500">Failed to load analytics.</div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                icon={<BookOpen size={18} className="text-[#0066ff]" />}
                label="Total Opens"
                value={data.summary.totalOpens.toLocaleString()}
              />
              <StatCard
                icon={<Users size={18} className="text-[#0066ff]" />}
                label="Unique Sessions"
                value={data.summary.uniqueSessions.toLocaleString()}
              />
              <StatCard
                icon={<CheckCircle size={18} className="text-[#0066ff]" />}
                label="Completion Rate"
                value={`${data.summary.completionRate}%`}
              />
              <StatCard
                icon={<Clock size={18} className="text-[#0066ff]" />}
                label="Avg Session"
                value={formatDuration(data.summary.avgSessionMs)}
              />
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
                <p className="text-xs text-gray-400 text-center mt-1">Color: green = long dwell · red = quick skip</p>
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
                    <span className="text-xs text-gray-500 font-medium uppercase tracking-wider">Page</span>
                    {Object.keys(data.heatmapData)
                      .map(Number)
                      .sort((a, b) => a - b)
                      .map((p) => (
                        <button
                          key={p}
                          onClick={() => setHeatmapPage(p)}
                          className={`text-sm py-1.5 px-3 rounded-lg text-left transition-colors ${
                            heatmapPage === p ? 'bg-[#0066ff] text-white' : 'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          Page {p}
                        </button>
                      ))}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded-xl overflow-hidden aspect-[1/1.41] relative shadow-inner max-w-sm mx-auto">
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
                      <div className="absolute inset-0 flex items-center justify-center text-sm text-gray-400">
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
                      <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                        <th className="pb-2 font-medium">Hotspot ID</th>
                        <th className="pb-2 font-medium text-right">Clicks</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.topHotspots.map((h) => (
                        <tr key={h.id} className="border-b border-gray-50">
                          <td className="py-2 font-mono text-xs text-gray-600 truncate max-w-[180px]">{h.id}</td>
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
                      <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                        <th className="pb-2 font-medium">Block / Page</th>
                        <th className="pb-2 font-medium text-right">Clicks</th>
                        <th className="pb-2 font-medium text-right">Unique</th>
                      </tr>
                    </thead>
                    <tbody>
                      {data.ctaData.map((c) => (
                        <tr key={c.id} className="border-b border-gray-50">
                          <td className="py-2">
                            <span className="font-mono text-xs text-gray-600 truncate">{c.id}</span>
                            {c.page && <span className="text-xs text-gray-400 ml-1">p.{c.page}</span>}
                          </td>
                          <td className="py-2 text-right font-medium">{c.clicks}</td>
                          <td className="py-2 text-right text-gray-500">{c.uniqueClicks}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </TableCard>
              )}
            </div>

            {data.pageViewData.length === 0 && data.topHotspots.length === 0 && (
              <div className="text-center py-16 bg-white rounded-2xl border border-gray-100">
                <p className="text-gray-500">No analytics data yet for this period.</p>
                <p className="text-sm text-gray-400 mt-1">Share your book to start collecting data.</p>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  )
}

function StatCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-4">
      <div className="flex items-center gap-2 mb-2">{icon}<span className="text-xs text-gray-500">{label}</span></div>
      <p className="text-2xl font-bold text-gray-900">{value}</p>
    </div>
  )
}

function ChartCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold mb-4 text-gray-700">{title}</h2>
      {children}
    </div>
  )
}

function TableCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-xl border border-gray-100 p-5">
      <h2 className="text-sm font-semibold mb-4 text-gray-700">{title}</h2>
      {children}
    </div>
  )
}
