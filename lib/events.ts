// Shared between the reader's event queue (`lib/tracking.ts`) and the route
// that receives it (`app/api/events/route.ts`). No server-only imports.

/** The most events one request to /api/events may carry. */
export const MAX_BATCH = 50

/** How many the reader queues before sending without waiting for the timer. */
export const CLIENT_BATCH = 20

/**
 * The page an event belongs to.
 *
 * Every caller puts it in the payload (`trackEvent(id, 'page_view', {
 * page_number })`) and nothing sends the top-level `pageNumber` this route
 * used to read, so `events.page_number` was NULL on every reader event, and
 * the per-page views, the reading funnel and the heatmap had nothing to group
 * by. Migration 022 backfills the rows written before this.
 */
export function pageNumberOf(event: {
  pageNumber?: number
  payload?: Record<string, unknown>
}): number | null {
  if (typeof event.pageNumber === 'number' && event.pageNumber > 0) return event.pageNumber
  const fromPayload = event.payload?.page_number
  if (typeof fromPayload === 'number' && Number.isInteger(fromPayload) && fromPayload > 0) {
    return fromPayload
  }
  return null
}
