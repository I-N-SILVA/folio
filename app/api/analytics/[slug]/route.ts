import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { subDays } from 'date-fns'

type DateRange = '7d' | '30d' | '90d' | 'all'

function getStartDate(range: DateRange): string | null {
  if (range === 'all') return null
  const days = range === '7d' ? 7 : range === '30d' ? 30 : 90
  return subDays(new Date(), days).toISOString()
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: book } = await supabaseAdmin
    .from('books')
    .select('id')
    .eq('slug', slug)
    .eq('owner_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const range = (request.nextUrl.searchParams.get('range') ?? '30d') as DateRange
  const startDate = getStartDate(range)

  let query = supabaseAdmin
    .from('events')
    .select('*')
    .eq('book_id', book.id)
    .order('created_at', { ascending: true })

  if (startDate) query = query.gte('created_at', startDate)

  const { data: events, error } = await query

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Compute stats server-side
  const totalOpens = events.filter((e) => e.event_type === 'book_open').length
  const sessions = new Set(events.map((e) => e.session_id))
  const uniqueSessions = sessions.size

  const completeSessions = new Set(
    events.filter((e) => e.event_type === 'book_complete').map((e) => e.session_id)
  ).size
  const completionRate = uniqueSessions > 0 ? Math.round((completeSessions / uniqueSessions) * 100) : 0

  // Average session duration from book_complete events
  const durations = events
    .filter((e) => e.event_type === 'book_complete' && e.payload?.session_duration_ms)
    .map((e) => e.payload.session_duration_ms as number)
  const avgSessionMs = durations.length > 0
    ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
    : 0

  // Page view counts
  const pageViews: Record<number, { views: number; totalDwell: number }> = {}
  events.filter((e) => e.event_type === 'page_view').forEach((e) => {
    const p = e.page_number ?? 0
    if (!pageViews[p]) pageViews[p] = { views: 0, totalDwell: 0 }
    pageViews[p].views++
    pageViews[p].totalDwell += (e.payload?.dwell_ms as number) ?? 0
  })

  const pageViewData = Object.entries(pageViews).map(([page, d]) => ({
    page: Number(page),
    views: d.views,
    avgDwellMs: d.views > 0 ? Math.round(d.totalDwell / d.views) : 0,
  })).sort((a, b) => a.page - b.page)

  // Funnel: % sessions that reached each page
  const sessionPageMap: Record<string, Set<number>> = {}
  events.filter((e) => e.event_type === 'page_view').forEach((e) => {
    if (!sessionPageMap[e.session_id]) sessionPageMap[e.session_id] = new Set()
    if (e.page_number) sessionPageMap[e.session_id].add(e.page_number)
  })
  const funnelPages = Array.from(new Set(events.filter(e => e.page_number).map(e => e.page_number))).sort()
  const funnelData = funnelPages.map((page) => ({
    page,
    sessions: Object.values(sessionPageMap).filter((s) => s.has(page as number)).length,
    pct: uniqueSessions > 0
      ? Math.round((Object.values(sessionPageMap).filter((s) => s.has(page as number)).length / uniqueSessions) * 100)
      : 0,
  }))

  // Hotspot clicks
  const hotspotCounts: Record<string, number> = {}
  events.filter((e) => e.event_type === 'hotspot_click').forEach((e) => {
    const id = e.payload?.hotspot_id as string
    if (id) hotspotCounts[id] = (hotspotCounts[id] ?? 0) + 1
  })
  const topHotspots = Object.entries(hotspotCounts)
    .map(([id, count]) => ({ id, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // CTA clicks
  const ctaCounts: Record<string, { label?: string; href?: string; page?: number; clicks: number; uniqueSessions: Set<string> }> = {}
  events.filter((e) => e.event_type === 'cta_click').forEach((e) => {
    const id = e.payload?.block_id as string
    if (!id) return
    if (!ctaCounts[id]) ctaCounts[id] = { clicks: 0, uniqueSessions: new Set(), href: e.payload?.href as string, page: e.page_number ?? undefined }
    ctaCounts[id].clicks++
    ctaCounts[id].uniqueSessions.add(e.session_id)
  })
  const ctaData = Object.entries(ctaCounts).map(([id, d]) => ({
    id,
    href: d.href,
    page: d.page,
    clicks: d.clicks,
    uniqueClicks: d.uniqueSessions.size,
  }))

  return NextResponse.json({
    summary: { totalOpens, uniqueSessions, completionRate, avgSessionMs },
    pageViewData,
    funnelData,
    topHotspots,
    ctaData,
    raw: events,
  })
}
