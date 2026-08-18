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
 * Aggregation happens here rather than in Postgres, which is the right trade at
 * this size and the wrong one later: the row cap below is what keeps a popular
 * edition from turning this page into a memory problem. When an account
 * routinely trips it, this becomes a materialised view keyed by (book, day).
 */
const MAX_ROWS = 20_000

export async function getEditionEngagement(
  userId: string,
  bookIds: string[],
  email?: string | null
): Promise<InsightsSummary> {
  const entitlements = await getUserEntitlements(userId, email)
  const windowDays = clampAnalyticsDays(null, entitlements)

  const empty: InsightsSummary = {
    windowDays,
    totalReaders: 0,
    totalLeads: 0,
    byBook: new Map(),
    truncated: false,
  }
  if (bookIds.length === 0) return empty

  const since = subDays(new Date(), windowDays).toISOString()

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
