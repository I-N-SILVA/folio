import { v4 as uuidv4 } from 'uuid'
import type { EventType } from './book-schema'
import { CLIENT_BATCH } from './events'

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

type QueuedEvent = {
  bookId: string
  sessionId: string
  eventType: EventType
  payload?: Record<string, unknown>
}

/** How long an event may wait for company before the queue sends anyway. */
const FLUSH_MS = 2_000

let queue: QueuedEvent[] = []
let timer: ReturnType<typeof setTimeout> | null = null
let listening = false

function send(events: QueuedEvent[]) {
  try {
    void fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ events }),
      // Keep the request alive past page unload, which is when the last
      // page's dwell time is flushed (ViewerEngine). `keepalive` bodies are
      // capped at 64 KB, which a batch of CLIENT_BATCH events is far under.
      keepalive: true,
    }).catch(() => {})
  } catch {
    // Analytics should never break the reader
  }
}

/** Sends everything queued, now. */
export function flushEvents(): void {
  if (timer) {
    clearTimeout(timer)
    timer = null
  }
  while (queue.length > 0) send(queue.splice(0, CLIENT_BATCH))
}

function listen() {
  if (listening || typeof window === 'undefined') return
  listening = true
  // The page can be closed at any moment, and a queued event that never
  // leaves is a page view that never happened. Both events, because
  // `pagehide` is the one mobile Safari reliably fires and `visibilitychange`
  // is the one desktop browsers fire before a tab is discarded.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flushEvents()
  })
  window.addEventListener('pagehide', flushEvents)
}

/**
 * Records a reader event.
 *
 * Queued and sent in batches: one request per event made every page turn two
 * serverless invocations and two inserts, which is the hottest path in the
 * product. The queue sends after FLUSH_MS, at CLIENT_BATCH events, or the
 * moment the page is hidden, whichever comes first. An event recorded while
 * the page is already hidden — the dwell flush on close — goes straight out.
 */
export async function trackEvent(
  bookId: string,
  eventType: EventType,
  payload?: Record<string, unknown>
): Promise<void> {
  try {
    if (!isTrackableBook(bookId)) return
    listen()
    queue.push({ bookId, sessionId: getSessionId(), eventType, payload })

    const hidden = typeof document !== 'undefined' && document.visibilityState === 'hidden'
    if (hidden || queue.length >= CLIENT_BATCH) {
      flushEvents()
    } else if (!timer) {
      timer = setTimeout(flushEvents, FLUSH_MS)
    }
  } catch {
    // Analytics should never break the reader
  }
}

/** For tests: forget anything queued. */
export function resetEventQueue(): void {
  if (timer) clearTimeout(timer)
  timer = null
  queue = []
}
