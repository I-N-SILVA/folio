import { describe, it, expect } from 'vitest'
import { pageSideFor, spreadFor } from './page-geometry'

describe('pageSideFor', () => {
  it('stands the cover alone', () => {
    expect(pageSideFor(0, false)).toBe('single')
  })

  it('pairs page 2 on the left with page 3 on the right', () => {
    expect(pageSideFor(1, false)).toBe('left')
    expect(pageSideFor(2, false)).toBe('right')
    expect(pageSideFor(3, false)).toBe('left')
    expect(pageSideFor(4, false)).toBe('right')
  })

  it('has no sides at all on a phone', () => {
    for (const i of [0, 1, 2, 5]) expect(pageSideFor(i, true)).toBe('single')
  })
})

describe('spreadFor', () => {
  it('gives the cover a spread of its own', () => {
    expect(spreadFor(0, 6)).toEqual({ left: null, right: 0 })
  })

  it('returns the same pair from either page in it', () => {
    expect(spreadFor(1, 6)).toEqual({ left: 1, right: 2 })
    expect(spreadFor(2, 6)).toEqual({ left: 1, right: 2 })
    expect(spreadFor(3, 6)).toEqual({ left: 3, right: 4 })
    expect(spreadFor(4, 6)).toEqual({ left: 3, right: 4 })
  })

  it('leaves the right side empty when the edition runs out', () => {
    // 5 pages: indices 0..4, so index 3 is a left with nothing facing it.
    expect(spreadFor(3, 4)).toEqual({ left: 3, right: null })
  })
})
