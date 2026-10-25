import { describe, it, expect } from 'vitest'
import { pageNumberOf } from './events'

describe('pageNumberOf', () => {
  it('reads the page from the payload, which is where every caller puts it', () => {
    // The regression: the route only read a top-level `pageNumber` that no
    // caller sends, so every reader event was stored with no page at all.
    expect(pageNumberOf({ payload: { page_number: 4, dwell_ms: 1200 } })).toBe(4)
  })

  it('prefers an explicit top-level page', () => {
    expect(pageNumberOf({ pageNumber: 2, payload: { page_number: 9 } })).toBe(2)
  })

  it('stores no page rather than a wrong one', () => {
    expect(pageNumberOf({})).toBeNull()
    expect(pageNumberOf({ payload: { page_number: '3' } })).toBeNull()
    expect(pageNumberOf({ payload: { page_number: 0 } })).toBeNull()
    expect(pageNumberOf({ payload: { page_number: 2.5 } })).toBeNull()
    expect(pageNumberOf({ payload: { page_number: -1 } })).toBeNull()
  })
})
