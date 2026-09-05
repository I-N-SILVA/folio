import { v4 as uuidv4 } from 'uuid'
import type { EventType } from './book-schema'

const SESSION_KEY = 'qlico_session_id'

export function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = uuidv4()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

/**
 * Editions that exist only in the bundle, not in the database.
 *
 * The gallery renders its six templates straight from `data/templates.ts` and
 * the demo edition comes from `data/books/` — neither has a row, so every event
 * they fire is a request the `events` foreign key can only reject. It was one
 * wasted round trip per page turn plus a 404 in the logs for every visitor
 * reading the shop window.
 *
 * A persisted book's id is a UUID; a bundled one is a readable string like
 * `gallery-fashion-lookbook` or `demo-book-id`. That is the whole test.
 */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isTrackableBook(bookId: string): boolean {
  return UUID.test(bookId)
}

export async function trackEvent(
  bookId: string,
  eventType: EventType,
  payload?: Record<string, unknown>
): Promise<void> {
  try {
    if (!isTrackableBook(bookId)) return
    const sessionId = getSessionId()
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, sessionId, eventType, payload }),
      // Keep the request alive past page unload — critical for the
      // pagehide/visibilitychange dwell-time flush in ViewerEngine.
      keepalive: true,
    })
  } catch {
    // Analytics should never break the reader
  }
}
