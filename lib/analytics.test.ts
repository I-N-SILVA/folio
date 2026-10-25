import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { aggregateEvents, type EventRow } from './analytics'

/**
 * The JS fallback and `edition_analytics` (022) feed the same dashboard, so
 * they must return the same document. `scripts/verify-migration.sql` checks
 * the SQL against 1,500 events; this checks the JS against the same story at
 * a small scale and pins the two shapes to each other.
 */

const at = '2026-10-01T00:00:00Z'
const row = (session: string, type: string, page: number | null, payload = {}): EventRow => ({
  session_id: session,
  event_type: type,
  page_number: page,
  payload,
  created_at: at,
})

describe('aggregateEvents', () => {
  const events: EventRow[] = []
  for (let s = 1; s <= 3; s++) {
    events.push(row(`s${s}`, 'book_open', null))
    for (let p = 1; p <= 2; p++) events.push(row(`s${s}`, 'page_view', p, { dwell_ms: 1000 }))
  }
  events.push(row('s1', 'book_complete', null, { session_duration_ms: 60000 }))
  events.push(row('s2', 'gate_view', 3))
  events.push(row('s2', 'gate_unlock', 3, { email: 'r@example.com' }))

  const a = aggregateEvents(events)

  it('counts sessions, opens and completion', () => {
    expect(a.summary).toEqual({
      totalOpens: 3,
      uniqueSessions: 3,
      completionRate: 33,
      avgSessionMs: 60000,
    })
  })

  it('groups page views by page — which needs page_number to be stored', () => {
    expect(a.pageViewData).toEqual([
      { page: 1, views: 3, avgDwellMs: 1000 },
      { page: 2, views: 3, avgDwellMs: 1000 },
    ])
  })

  it('reports leads and the gate funnel', () => {
    expect(a.leadData).toHaveLength(1)
    expect(a.gate).toEqual({ views: 1, unlocks: 1, rate: 100 })
  })

  it('returns the same top-level keys as edition_analytics', () => {
    const sql = readFileSync(
      join(process.cwd(), 'supabase', 'migrations', '022_analytics_at_scale.sql'),
      'utf8'
    )
    // The document's keys are the ones whose value is a CTE: `'summary', (SELECT j FROM summary)`.
    const sqlKeys = [...sql.matchAll(/'(\w+)',\s+\(SELECT j FROM \w+\)/g)].map((m) => m[1]).sort()
    expect(sqlKeys.length).toBeGreaterThan(0)
    expect(Object.keys(a).sort()).toEqual(sqlKeys)
  })
})
