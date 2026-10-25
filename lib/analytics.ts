// ─── Per-edition analytics, computed in JavaScript ──────────────────────────
//
// The fallback for a deployment that has not applied 022. With it, the route
// asks Postgres (`edition_analytics`) and none of this runs: counting in the
// database is exact at any volume, and this is only exact for the rows it is
// given. The route therefore hands it every row in the window, fetched in
// pages, rather than whatever one response happened to hold.
//
// The output shape is the contract with the dashboard, and `edition_analytics`
// returns the same one. `lib/analytics.test.ts` pins it.

export type EventRow = {
  session_id: string
  event_type: string
  page_number: number | null
  payload: Record<string, any>
  created_at: string
}

export function aggregateEvents(events: EventRow[]) {
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

  // Heatmap Data (page_click)
  const heatmapData: Record<number, Array<{ x: number; y: number }>> = {}
  events.filter((e) => e.event_type === 'page_click').forEach((e) => {
    const p = e.page_number ?? 0
    if (!heatmapData[p]) heatmapData[p] = []
    if (e.payload?.x != null && e.payload?.y != null) {
      heatmapData[p].push({ x: e.payload.x as number, y: e.payload.y as number })
    }
  })

  // Gate Unlock (Lead Generation)
  const leadData: Array<{ email: string; timestamp: string; page: number }> = []
  events.filter((e) => e.event_type === 'gate_unlock').forEach((e) => {
    if (e.payload?.email) {
      leadData.push({
        email: e.payload.email as string,
        timestamp: e.created_at,
        page: e.page_number ?? 3,
      })
    }
  })

  // Gate funnel. Unlocks alone are a count with no denominator — the author
  // can't tell a gate nobody reaches from a gate nobody converts on.
  const gateViewSessions = new Set(
    events.filter((e) => e.event_type === 'gate_view').map((e) => e.session_id)
  )
  const gateUnlockSessions = new Set(
    events.filter((e) => e.event_type === 'gate_unlock').map((e) => e.session_id)
  )
  const gate = {
    views: gateViewSessions.size,
    unlocks: gateUnlockSessions.size,
    rate: gateViewSessions.size
      ? Math.round((gateUnlockSessions.size / gateViewSessions.size) * 100)
      : 0,
  }

  return {
    gate,
    summary: { totalOpens, uniqueSessions, completionRate, avgSessionMs },
    pageViewData,
    funnelData,
    topHotspots,
    ctaData,
    heatmapData,
    leadData,
  }
}

export type EditionAnalytics = ReturnType<typeof aggregateEvents>
