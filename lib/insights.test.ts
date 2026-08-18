import { describe, expect, it } from 'vitest'
import { aggregateEngagement, type EngagementRow } from './insights'

function row(
  book_id: string,
  session_id: string,
  event_type: string,
  created_at = '2026-06-01T10:00:00Z'
): EngagementRow {
  return { book_id, session_id, event_type, created_at }
}

describe('aggregateEngagement', () => {
  it('counts a reader once however many times they open it', () => {
    // Readers are distinct sessions, not `book_open` events. Counting opens is
    // how an author refreshing their own tab becomes an audience.
    const result = aggregateEngagement(
      [row('b1', 's1', 'book_open'), row('b1', 's1', 'book_open'), row('b1', 's2', 'book_open')],
      ['b1']
    )
    expect(result.byBook.get('b1')?.readers).toBe(2)
    expect(result.totalReaders).toBe(2)
  })

  it('computes completion against readers, not against opens', () => {
    const result = aggregateEngagement(
      [
        row('b1', 's1', 'book_open'),
        row('b1', 's1', 'book_complete'),
        row('b1', 's2', 'book_open'),
        row('b1', 's3', 'book_open'),
        row('b1', 's3', 'book_complete'),
      ],
      ['b1']
    )
    expect(result.byBook.get('b1')?.completionRate).toBe(67)
  })

  it('reports zero completion rather than dividing by zero', () => {
    const result = aggregateEngagement([], ['b1'])
    expect(result.byBook.get('b1')).toEqual({
      bookId: 'b1',
      readers: 0,
      completionRate: 0,
      leads: 0,
      lastReadAt: null,
    })
  })

  it('counts every captured email, including repeat addresses', () => {
    // A gate unlock is a lead event; two unlocks are two rows to follow up on
    // even if the reader typed the same address twice.
    const result = aggregateEngagement(
      [row('b1', 's1', 'gate_unlock'), row('b1', 's2', 'gate_unlock')],
      ['b1']
    )
    expect(result.byBook.get('b1')?.leads).toBe(2)
    expect(result.totalLeads).toBe(2)
  })

  it('counts a reader of two editions once in the total', () => {
    const result = aggregateEngagement(
      [row('b1', 's1', 'book_open'), row('b2', 's1', 'book_open')],
      ['b1', 'b2']
    )
    expect(result.byBook.get('b1')?.readers).toBe(1)
    expect(result.byBook.get('b2')?.readers).toBe(1)
    expect(result.totalReaders).toBe(1)
  })

  it('takes last-read from the first row, since the query is newest-first', () => {
    const result = aggregateEngagement(
      [
        row('b1', 's2', 'book_open', '2026-06-02T00:00:00Z'),
        row('b1', 's1', 'book_open', '2026-05-01T00:00:00Z'),
      ],
      ['b1']
    )
    expect(result.byBook.get('b1')?.lastReadAt).toBe('2026-06-02T00:00:00Z')
  })

  it('gives a row for every edition asked about, including silent ones', () => {
    const result = aggregateEngagement([row('b1', 's1', 'book_open')], ['b1', 'b2'])
    expect(result.byBook.has('b2')).toBe(true)
    expect(result.byBook.get('b2')?.readers).toBe(0)
  })

  it('ignores events for editions that were not asked about', () => {
    const result = aggregateEngagement([row('other', 's1', 'book_open')], ['b1'])
    expect(result.byBook.has('other')).toBe(false)
    // The session still counted nowhere, because no requested edition saw it.
    expect(result.totalReaders).toBe(0)
  })

  it('does not claim truncation for a small result set', () => {
    expect(aggregateEngagement([row('b1', 's1', 'book_open')], ['b1']).truncated).toBe(false)
  })
})
