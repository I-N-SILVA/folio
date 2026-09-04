import { describe, it, expect } from 'vitest'
import { isTrackableBook } from './tracking'

describe('isTrackableBook', () => {
  it('tracks a real edition, whose id is a database UUID', () => {
    expect(isTrackableBook('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(true)
    expect(isTrackableBook(crypto.randomUUID())).toBe(true)
  })

  it('does not track the gallery, which renders templates with no rows behind them', () => {
    // Every event these fire is a request the events foreign key can only
    // reject — one wasted round trip per page turn, and a 404 in the logs for
    // every visitor reading the shop window.
    expect(isTrackableBook('gallery-fashion-lookbook')).toBe(false)
    expect(isTrackableBook('gallery-culinary-menu')).toBe(false)
  })

  it('does not track the bundled demo edition', () => {
    expect(isTrackableBook('demo-book-id')).toBe(false)
  })

  it('rejects anything that merely looks uuid-ish', () => {
    expect(isTrackableBook('')).toBe(false)
    expect(isTrackableBook('not-a-uuid')).toBe(false)
    expect(isTrackableBook('3f2504e0-4f89-11d3-9a0c')).toBe(false)
    expect(isTrackableBook('3f2504e0-4f89-11d3-9a0c-0305e82c3301-extra')).toBe(false)
  })
})
