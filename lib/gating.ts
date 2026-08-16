import type { Book, Page } from './book-schema'

/**
 * Lead gating, enforced on the server.
 *
 * The gate used to be presentation only: every page was sent to the browser and
 * an overlay blurred the ones past the boundary. Deleting that overlay in
 * devtools — or reading the page source — revealed the whole edition, so the
 * feature people pay for didn't actually withhold anything. Pages past the
 * boundary are now never serialised into the initial response; the reader asks
 * for them once an email has been submitted.
 */

/**
 * Whether the gate is live for this book.
 *
 * `settings.gating.enabled` alone is not the answer: it is an author-controlled
 * boolean written straight to the database by the editor, and lead capture is
 * sold on the paid plans. Callers that know the owner's entitlements pass
 * `gateEnabled` from `readerPolicy()`; the default (undefined) keeps the old
 * book-only behaviour for callers that legitimately have no owner, such as the
 * bundled demo editions.
 */
function isGated(book: Book, gateEnabled?: boolean): boolean {
  if (gateEnabled === false) return false
  return book.settings?.gating?.enabled === true
}

/** Pages before the gate — how many a reader sees without giving an email. */
export function freePageCount(book: Book, gateEnabled?: boolean): number {
  const gating = book.settings?.gating
  const total = book.pages?.length ?? 0
  if (!isGated(book, gateEnabled)) return total
  // `page_number` is 1-based in the editor: a gate at page 3 means pages 1 and
  // 2 are free, and 3 onward are withheld.
  const boundary = Math.max(1, gating.page_number ?? 3) - 1
  return Math.min(boundary, total)
}

export interface GatedBook {
  /** The book with withheld pages removed. */
  book: Book
  /** How many pages were withheld. Zero means nothing is gated. */
  lockedCount: number
}

/** Strips pages past the gate. Safe to call on ungated books. */
export function applyGate(book: Book, gateEnabled?: boolean): GatedBook {
  const pages = book.pages ?? []

  if (!isGated(book, gateEnabled) || pages.length === 0) return { book, lockedCount: 0 }

  const free = freePageCount(book, gateEnabled)
  if (free >= pages.length) return { book, lockedCount: 0 }

  return {
    book: { ...book, pages: pages.slice(0, free) },
    lockedCount: pages.length - free,
  }
}

/** The pages an unlock request should hand back. */
export function lockedPages(book: Book, gateEnabled?: boolean): Page[] {
  if (!isGated(book, gateEnabled)) return []
  return (book.pages ?? []).slice(freePageCount(book, gateEnabled))
}
