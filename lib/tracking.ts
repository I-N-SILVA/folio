import { v4 as uuidv4 } from 'uuid'
import type { EventType } from './book-schema'

const SESSION_KEY = 'folio_session_id'

function getSessionId(): string {
  if (typeof window === 'undefined') return ''
  let id = sessionStorage.getItem(SESSION_KEY)
  if (!id) {
    id = uuidv4()
    sessionStorage.setItem(SESSION_KEY, id)
  }
  return id
}

export async function trackEvent(
  bookId: string,
  eventType: EventType,
  payload?: Record<string, unknown>
): Promise<void> {
  try {
    const sessionId = getSessionId()
    await fetch('/api/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bookId, sessionId, eventType, payload }),
    })
  } catch {
    // Analytics should never break the reader
  }
}
