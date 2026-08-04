// Shared pieces of the PDF import flow, used by both halves of it: the route
// that begins an import and hands out signed upload targets, and the one that
// finalises whatever landed in storage into page rows.

/** Ceiling on pages taken from one PDF. */
export const MAX_IMPORT_PAGES = 50

/** Storage path for a rendered page. Server-chosen, never client-supplied. */
export function pagePath(bookId: string, pageNumber: number): string {
  return `books/${bookId}/pages/page-${pageNumber}.png`
}

/** Recovers the page number from a storage object name, or null if it isn't one. */
export function pageNumberFromName(name: string): number | null {
  const match = /^page-(\d+)\.png$/.exec(name)
  if (!match) return null
  const n = Number(match[1])
  return Number.isInteger(n) && n >= 1 && n <= MAX_IMPORT_PAGES ? n : null
}

/**
 * The page role for a given position. A one-page import is a cover and nothing
 * else — it must not also be tagged 'back', which is what
 * `idx === total - 1 ? 'back'` did when total was 1.
 */
export function pageType(pageNumber: number, total: number): 'cover' | 'content' | 'back' {
  if (pageNumber === 1) return 'cover'
  if (pageNumber === total) return 'back'
  return 'content'
}

/** Runs `fn` over `items` with at most `limit` in flight, preserving order. */
export async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}
