import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { subDays } from 'date-fns'
import { getUserEntitlements } from '@/lib/entitlements'
import { clampAnalyticsDays } from '@/lib/plans'
import { supabaseAdmin } from '@/lib/supabase'
import { aggregateEvents, type EditionAnalytics, type EventRow } from '@/lib/analytics'

/** PostgREST's default response cap; the fallback reads in pages of this. */
const PAGE_SIZE = 1000
/** Where the fallback stops reading, so one dashboard load stays bounded. */
const FALLBACK_MAX_ROWS = 50_000

type DateRange = '7d' | '30d' | '90d' | '365d' | 'all'

/**
 * Days the caller asked for, or null for "all time".
 *
 * "All time" was previously honoured literally, which meant the retention
 * window sold on every plan — 30 days on Free, 12 months on Pro — was a label on
 * a range picker and nothing else. The requested value is now only an upper
 * bound; `clampAnalyticsDays` decides what is actually queried.
 */
function requestedDays(range: DateRange): number | null {
  if (range === 'all') return null
  return range === '7d' ? 7 : range === '30d' ? 30 : range === '90d' ? 90 : 365
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  const { slug } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership. The user-scoped client + RLS (owner_all) guarantees this
  // only returns a row the caller actually owns — no service-role bypass.
  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('slug', slug)
    .eq('owner_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const range = (request.nextUrl.searchParams.get('range') ?? '30d') as DateRange
  const entitlements = await getUserEntitlements(user.id, user.email)
  const days = clampAnalyticsDays(requestedDays(range), entitlements)
  const startDate = subDays(new Date(), days).toISOString()

  // Counted in Postgres. The previous version selected the raw rows and added
  // them up here, and PostgREST returns at most 1,000 rows a response by
  // default — so past ~70 reads in the window every figure was a silent
  // undercount, on exactly the editions that were working. Service role
  // because ownership is established above and the function is not granted to
  // client roles, the same arrangement as `edition_engagement`.
  let stats: EditionAnalytics
  const { data: computed, error: rpcError } = await supabaseAdmin.rpc('edition_analytics', {
    p_book_id: book.id,
    p_since: startDate,
  })

  if (!rpcError && computed) {
    stats = computed as EditionAnalytics
  } else {
    // 022 not applied: fall back to counting here, over every row in the
    // window rather than the first page of them.
    if (rpcError) console.warn('[analytics] edition_analytics unavailable:', rpcError.message)
    const events: EventRow[] = []
    for (let from = 0; from < FALLBACK_MAX_ROWS; from += PAGE_SIZE) {
      const { data: page, error } = await supabase
        .from('events')
        .select('session_id, event_type, page_number, payload, created_at')
        .eq('book_id', book.id)
        .gte('created_at', startDate)
        .order('created_at', { ascending: true })
        .range(from, from + PAGE_SIZE - 1)
      if (error) return NextResponse.json({ error: error.message }, { status: 500 })
      events.push(...((page ?? []) as EventRow[]))
      if (!page || page.length < PAGE_SIZE) break
    }
    stats = aggregateEvents(events)
  }

  return NextResponse.json({
    ...stats,
    // What the caller is actually looking at, so the UI can say so rather than
    // implying the range button it highlighted is the range it got.
    window: {
      days,
      limitDays: entitlements.analyticsDays,
      clamped: requestedDays(range) === null || days < (requestedDays(range) ?? 0),
    },
    csvExport: entitlements.csvExport,
    // `raw: events` used to ride along here purely so the browser could build a
    // CSV — every event row of every edition, on every dashboard load. That
    // breaks precisely when an edition succeeds. Export is a server route now:
    // /api/analytics/[slug]/export.
  })
}
