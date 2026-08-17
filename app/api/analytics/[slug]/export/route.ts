import { NextRequest, NextResponse } from 'next/server'
import { subDays } from 'date-fns'
import { createServerSupabase } from '@/lib/supabase-server'
import { getUserEntitlements } from '@/lib/entitlements'
import { clampAnalyticsDays } from '@/lib/plans'

/**
 * CSV export of an edition's events or captured leads.
 *
 * This used to happen in the browser, from a `raw: events` array the analytics
 * endpoint shipped on every dashboard load. Two things were wrong with that: the
 * payload grew without bound exactly as an edition succeeded, and `csvExport` —
 * an entitlement sold on the paid plans — could not be enforced anywhere,
 * because the data was already on the client by the time the button was pressed.
 *
 * Rows are streamed out in one pass and capped, so a large edition produces a
 * large file rather than an out-of-memory function.
 */

const MAX_ROWS = 50_000

type Kind = 'events' | 'leads'

/** RFC 4180 quoting — `payload` is stringified JSON and reliably contains commas. */
function csvCell(value: unknown): string {
  const s =
    value === null || value === undefined
      ? ''
      : typeof value === 'object'
        ? JSON.stringify(value)
        : String(value)
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

function csvRow(cells: unknown[]): string {
  return cells.map(csvCell).join(',') + '\n'
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const entitlements = await getUserEntitlements(user.id, user.email)
  if (!entitlements.csvExport) {
    return NextResponse.json(
      {
        error: 'CSV export is available on paid plans.',
        code: 'plan_feature',
        feature: 'csvExport',
      },
      { status: 403 }
    )
  }

  // Ownership via the user-scoped client, so RLS decides — the same shape the
  // analytics route uses. `books` carries a public read policy for published
  // editions, so an unqualified select here would not be scoped the way it looks.
  const { data: book } = await supabase
    .from('books')
    .select('id')
    .eq('slug', slug)
    .eq('owner_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const kind: Kind = request.nextUrl.searchParams.get('kind') === 'leads' ? 'leads' : 'events'
  const requested = Number(request.nextUrl.searchParams.get('days'))
  const days = clampAnalyticsDays(Number.isFinite(requested) ? requested : null, entitlements)
  const startDate = subDays(new Date(), days).toISOString()

  let query = supabase
    .from('events')
    .select('id, book_id, session_id, event_type, page_number, payload, created_at')
    .eq('book_id', book.id)
    .gte('created_at', startDate)
    .order('created_at', { ascending: true })
    .limit(MAX_ROWS)

  if (kind === 'leads') query = query.eq('event_type', 'gate_unlock')

  const { data: rows, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const events = rows ?? []
  let body: string

  if (kind === 'leads') {
    body = csvRow(['email', 'captured_at', 'page_number'])
    for (const e of events) {
      const email = (e.payload as Record<string, unknown> | null)?.email
      if (!email) continue
      body += csvRow([email, e.created_at, e.page_number ?? ''])
    }
  } else {
    body = csvRow([
      'id',
      'book_id',
      'session_id',
      'event_type',
      'page_number',
      'payload',
      'created_at',
    ])
    for (const e of events) {
      body += csvRow([
        e.id,
        e.book_id,
        e.session_id,
        e.event_type,
        e.page_number ?? '',
        e.payload,
        e.created_at,
      ])
    }
  }

  return new NextResponse(body, {
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${slug}-${kind}.csv"`,
      'Cache-Control': 'no-store',
    },
  })
}
