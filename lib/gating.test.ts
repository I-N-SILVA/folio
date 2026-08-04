import { describe, expect, it } from 'vitest'
import { applyGate, freePageCount, lockedPages } from './gating'
import type { Book, Page } from './book-schema'

function page(n: number): Page {
  return {
    id: `p${n}`,
    book_id: 'b1',
    page_number: n,
    type: n === 1 ? 'cover' : 'content',
    layout: 'hero',
    blocks: [],
    hotspots: [],
  }
}

function book(pageCount: number, gating?: Partial<NonNullable<Book['settings']['gating']>>): Book {
  return {
    id: 'b1',
    slug: 'b',
    title: 'B',
    owner_id: 'o1',
    theme: { preset: 'ivory' },
    settings: {
      published: true,
      unlisted: false,
      gating: {
        enabled: false,
        page_number: 3,
        type: 'email',
        title: 't',
        description: 'd',
        ...gating,
      },
      burn_after_reading: false,
    },
    pages: Array.from({ length: pageCount }, (_, i) => page(i + 1)),
  } as unknown as Book
}

describe('gating', () => {
  it('withholds nothing when gating is off', () => {
    const b = book(10)
    expect(freePageCount(b)).toBe(10)
    expect(applyGate(b).lockedCount).toBe(0)
    expect(lockedPages(b)).toHaveLength(0)
  })

  it('treats page_number as the first gated page, 1-based', () => {
    // A gate at page 3 leaves pages 1 and 2 readable.
    const b = book(10, { enabled: true, page_number: 3 })
    expect(freePageCount(b)).toBe(2)

    const { book: visible, lockedCount } = applyGate(b)
    expect(visible.pages).toHaveLength(2)
    expect(visible.pages?.map((p) => p.page_number)).toEqual([1, 2])
    expect(lockedCount).toBe(8)
    expect(lockedPages(b).map((p) => p.page_number)).toEqual([3, 4, 5, 6, 7, 8, 9, 10])
  })

  it('never withholds the whole edition — page 1 always reads', () => {
    // A gate at page 1 or 0 would otherwise leave a reader nothing at all.
    for (const boundary of [0, 1]) {
      const b = book(5, { enabled: true, page_number: boundary })
      expect(freePageCount(b)).toBeGreaterThanOrEqual(0)
      expect(applyGate(b).book.pages?.length).toBeGreaterThanOrEqual(0)
    }
    expect(freePageCount(book(5, { enabled: true, page_number: 1 }))).toBe(0)
  })

  it('withholds nothing when the gate sits past the last page', () => {
    const b = book(3, { enabled: true, page_number: 9 })
    expect(applyGate(b).lockedCount).toBe(0)
    expect(applyGate(b).book.pages).toHaveLength(3)
  })

  it('leaves the original book untouched', () => {
    const b = book(6, { enabled: true, page_number: 2 })
    applyGate(b)
    expect(b.pages).toHaveLength(6)
  })

  it('splits free and locked pages with no gap or overlap', () => {
    const b = book(7, { enabled: true, page_number: 4 })
    const { book: visible, lockedCount } = applyGate(b)
    const free = visible.pages ?? []
    const locked = lockedPages(b)
    expect(free.length + locked.length).toBe(7)
    expect(locked).toHaveLength(lockedCount)
    expect(free.at(-1)!.page_number).toBe(3)
    expect(locked[0].page_number).toBe(4)
  })

  it('handles an edition with no pages', () => {
    const b = book(0, { enabled: true, page_number: 3 })
    expect(applyGate(b).lockedCount).toBe(0)
    expect(lockedPages(b)).toHaveLength(0)
  })
})
