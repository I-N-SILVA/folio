import { describe, it, expect, vi } from 'vitest'
import {
  MAX_IMPORT_PAGES,
  pagePath,
  pageNumberFromName,
  pageType,
  mapWithConcurrency,
} from './import'

describe('pagePath', () => {
  it('is server-derived from the book id and page number', () => {
    expect(pagePath('abc', 1)).toBe('books/abc/pages/page-1.png')
    expect(pagePath('abc', 42)).toBe('books/abc/pages/page-42.png')
  })
})

describe('pageNumberFromName', () => {
  it('reads back the numbers it writes', () => {
    for (const n of [1, 7, 50]) {
      expect(pageNumberFromName(`page-${n}.png`)).toBe(n)
    }
  })

  it('rejects anything that is not a page object', () => {
    // finalize lists a storage prefix and trusts nothing in it — an unexpected
    // object must not become a page.
    for (const name of ['source.pdf', 'page-.png', 'page-1.jpg', 'cover.png', '', '.emptyFolderPlaceholder']) {
      expect(pageNumberFromName(name), name).toBeNull()
    }
  })

  it('rejects numbers outside the import range', () => {
    expect(pageNumberFromName('page-0.png')).toBeNull()
    expect(pageNumberFromName(`page-${MAX_IMPORT_PAGES + 1}.png`)).toBeNull()
  })

  it('rejects a traversal attempt', () => {
    expect(pageNumberFromName('../../page-1.png')).toBeNull()
  })
})

describe('pageType', () => {
  it('marks the first page cover and the last back', () => {
    expect(pageType(1, 5)).toBe('cover')
    expect(pageType(3, 5)).toBe('content')
    expect(pageType(5, 5)).toBe('back')
  })

  it('calls a single-page import a cover, not a back cover', () => {
    // Both branches match when total is 1, so the order of the checks is the
    // only thing deciding this. Pinned because it is silently reversible.
    expect(pageType(1, 1)).toBe('cover')
  })

  it('handles a two-page import', () => {
    expect(pageType(1, 2)).toBe('cover')
    expect(pageType(2, 2)).toBe('back')
  })
})

describe('mapWithConcurrency', () => {
  it('preserves order regardless of completion order', async () => {
    const items = [30, 10, 20, 0]
    const result = await mapWithConcurrency(items, 2, async (ms, i) => {
      await new Promise((r) => setTimeout(r, ms))
      return `${i}:${ms}`
    })
    expect(result).toEqual(['0:30', '1:10', '2:20', '3:0'])
  })

  it('never exceeds the concurrency limit', async () => {
    let inFlight = 0
    let peak = 0
    await mapWithConcurrency(Array.from({ length: 20 }, (_, i) => i), 4, async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
    })
    expect(peak).toBe(4)
  })

  it('handles an empty list without spawning workers', async () => {
    const fn = vi.fn()
    await expect(mapWithConcurrency([], 4, fn)).resolves.toEqual([])
    expect(fn).not.toHaveBeenCalled()
  })

  it('does not spawn more workers than items', async () => {
    let peak = 0
    let inFlight = 0
    await mapWithConcurrency([1, 2], 10, async () => {
      inFlight++
      peak = Math.max(peak, inFlight)
      await new Promise((r) => setTimeout(r, 5))
      inFlight--
    })
    expect(peak).toBe(2)
  })
})
