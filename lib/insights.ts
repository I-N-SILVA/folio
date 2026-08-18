import 'server-only'
import { subDays } from 'date-fns'
import { supabaseAdmin } from '@/lib/supabase'
import { getUserEntitlements } from '@/lib/entitlements'
import { clampAnalyticsDays } from '@/lib/plans'

/**
 * Cross-edition engagement for the studio.
 *
 * The product recorded a lot about readers and showed the author almost none of
 * it: analytics lived behind a small icon on a single book card, one edition at
 * a time, so there was no screen that answered "is anything I published being
 * read?" — the only question that brings someone back tomorrow. The dashboard
 * counted books, published books and pages instead, all of which measure the
 * author's own output and none of which change while they're away.
 */

export type EditionEngagement = {
  bookId: string
  /** Distinct reader sessions that opened the edition in the window. */
  readers: number
  /** Sessions that reached the last page, as a percentage of readers. */
  completionRate: number
  /** Email addresses captured by the lead gate. */
  leads: number
  /** Most recent reader activity, for "last read" lines. */
  lastReadAt: string | null
}

export type InsightsSummary = {
  windowDays: number
  totalReaders: number
  totalLeads: number
  byBook: Map<string, EditionEngagement>
  /**
   * Whether the row cap was reached, i.e. the numbers below are a floor rather
   * than a total. Surfaced in the UI: a silent truncation reads as "this is how
   * many people read it", which would be wrong in the one direction that
   * matters to someone deciding whether the product works.
   */
  truncated: boolean
}

/**
 * Cap on the JavaScript fallback path only.
 *
 * The aggregate is computed in Postgres now (`edition_engagement`, migration
 * 012), which is both exact and cheaper — three COUNT(DISTINCT) per edition
 * instead of tens of thousands of rows crossing the wire. This constant governs
 * the fallback used when that migration hasn't been applied, where the cap is
 * what stops a popular account turning the dashboard into a memory problem. On
 * that path the figures are a floor, and `truncated` says so.
 */
const MAX_ROWS = 20_000

export async function getEditionEngagement(
  userId: string,
  bookIds: string[],
  email?: string | null,
  /**
   * Days to look back. Defaults to the whole window the plan retains, which is
   * what the Insights screen wants. The weekly digest passes 7 — it says "this
   * week", and reporting the plan's full window under that heading would mean a
   * Pro account's digest opened with a year's readers and then repeated the same
   * cumulative number every Monday. Still clamped to the plan, so this can
   * narrow the window and never widen it.
   */
  days?: number
): Promise<InsightsSummary> {
  const entitlements = await getUserEntitlements(userId, email)
  const windowDays = clampAnalyticsDays(days ?? null, entitlements)

  const empty: InsightsSummary = {
    windowDays,
    totalReaders: 0,
    totalLeads: 0,
    byBook: new Map(),
    truncated: false,
  }
  if (bookIds.length === 0) return empty

  const since = subDays(new Date(), windowDays).toISOString()

  // Preferred path: count in the database.
  const rpc = await supabaseAdmin.rpc('edition_engagement', {
    p_book_ids: bookIds,
    p_since: since,
  })

  if (!rpc.error && rpc.data) {
    return { windowDays, ...fromRpc(rpc.data as EngagementAggregate[], bookIds) }
  }

  // PGRST202 / 42883 mean migration 012 hasn't been applied. Anything else is a
  // real failure, but the fallback answers the question either way, so it is
  // worth taking rather than showing the author nothing.
  const missingFunction = rpc.error?.code === 'PGRST202' || rpc.error?.code === '42883'
  if (!missingFunction) {
    console.error('[insights] edition_engagement failed:', rpc.error)
  } else {
    console.error(
      '[insights] edition_engagement() is missing — apply ' +
        'supabase/migrations/012_edition_engagement.sql. Falling back to a capped client-side count.'
    )
  }

  // Only the four columns the aggregate needs. `payload` in particular is
  // stringified JSON on every row and is never read here.
  const { data, error } = await supabaseAdmin
    .from('events')
    .select('book_id, session_id, event_type, created_at')
    .in('book_id', bookIds)
    .gte('created_at', since)
    .in('event_type', ['book_open', 'book_complete', 'gate_unlock'])
    .order('created_at', { ascending: false })
    .limit(MAX_ROWS)

  if (error || !data) return empty

  return { windowDays, ...aggregateEngagement(data as EngagementRow[], bookIds) }
}

export type EngagementAggregate = {
  book_id: string
  readers: number
  completions: number
  leads: number
  last_read_at: string | null
}

/** Shapes the database's own aggregate into what the UI reads. */
export function fromRpc(
  rows: EngagementAggregate[],
  bookIds: string[]
): Omit<InsightsSummary, 'windowDays'> {
  const byId = new Map(rows.map((r) => [r.book_id, r]))
  const byBook = new Map<string, EditionEngagement>()
  let totalReaders = 0
  let totalLeads = 0

  for (const bookId of bookIds) {
    const row = byId.get(bookId)
    const readers = Number(row?.readers ?? 0)
    const completions = Number(row?.completions ?? 0)
    const leads = Number(row?.leads ?? 0)

    // Note this differs from the fallback: the database counts each edition's
    // sessions independently, so one person reading two editions counts in both
    // and therefore twice in the total. Deduplicating across editions would mean
    // shipping the session ids back, which is the cost this path exists to
    // avoid — and "readers across your editions" is the more useful reading of
    // the number anyway.
    totalReaders += readers
    totalLeads += leads

    byBook.set(bookId, {
      bookId,
      readers,
      completionRate: readers ? Math.round((completions / readers) * 100) : 0,
      leads,
      lastReadAt: row?.last_read_at ?? null,
    })
  }

  return { totalReaders, totalLeads, byBook, truncated: false }
}

export type EngagementRow = {
  book_id: string
  session_id: string
  event_type: string
  created_at: string
}

/**
 * The counting itself, separated from the query so it can be tested.
 *
 * Readers are distinct sessions rather than `book_open` events — one person who
 * opens an edition three times in a day is one reader, and treating opens as
 * readers is how an author's own tab-refreshing turns into an audience.
 */
export function aggregateEngagement(
  rows: EngagementRow[],
  bookIds: string[]
): Omit<InsightsSummary, 'windowDays'> {
  const data = rows
  const openers = new Map<string, Set<string>>()
  const completers = new Map<string, Set<string>>()
  const leads = new Map<string, number>()
  const lastRead = new Map<string, string>()

  for (const row of data) {
    const id = row.book_id as string
    if (!lastRead.has(id)) lastRead.set(id, row.created_at as string)

    if (row.event_type === 'book_open') {
      if (!openers.has(id)) openers.set(id, new Set())
      openers.get(id)!.add(row.session_id as string)
    } else if (row.event_type === 'book_complete') {
      if (!completers.has(id)) completers.set(id, new Set())
      completers.get(id)!.add(row.session_id as string)
    } else if (row.event_type === 'gate_unlock') {
      leads.set(id, (leads.get(id) ?? 0) + 1)
    }
  }

  const byBook = new Map<string, EditionEngagement>()
  const allReaders = new Set<string>()
  let totalLeads = 0

  for (const bookId of bookIds) {
    const readerSessions = openers.get(bookId) ?? new Set<string>()
    const completed = completers.get(bookId)?.size ?? 0
    const bookLeads = leads.get(bookId) ?? 0

    readerSessions.forEach((s) => allReaders.add(s))
    totalLeads += bookLeads

    byBook.set(bookId, {
      bookId,
      readers: readerSessions.size,
      completionRate: readerSessions.size ? Math.round((completed / readerSessions.size) * 100) : 0,
      leads: bookLeads,
      lastReadAt: lastRead.get(bookId) ?? null,
    })
  }

  return {
    totalReaders: allReaders.size,
    totalLeads,
    byBook,
    truncated: rows.length >= MAX_ROWS,
  }
}
