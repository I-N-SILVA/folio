import { NextRequest, NextResponse } from 'next/server'
import { EVENT_TYPES } from '@/lib/book-schema'
import { z } from 'zod'
import { supabaseAdmin, hasServiceRoleKey } from '@/lib/supabase'
import { rateLimitCost, clientIp } from '@/lib/rate-limit'
import { MAX_BATCH, pageNumberOf } from '@/lib/events'

const EventBodySchema = z.object({
  bookId: z.string(),
  sessionId: z.string(),
  // One list, in lib/book-schema. See EVENT_TYPES for why.
  eventType: z.enum(EVENT_TYPES),
  pageNumber: z.number().int().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

/**
 * One event, or a batch of them.
 *
 * The reader used to send one request per event — a page turn was a `page_view`
 * and a `page_flip`, each its own serverless invocation and its own insert.
 * `lib/tracking.ts` now queues them and sends a batch. A single event is still
 * accepted, so a reader holding an old bundle keeps recording.
 */
const BodySchema = z.union([
  z.object({ events: z.array(EventBodySchema).min(1).max(MAX_BATCH) }),
  EventBodySchema,
])

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = BodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const events = 'events' in parsed.data ? parsed.data.events : [parsed.data]

    // Analytics is unauthenticated by design (public readers). Throttled per IP
    // and charged per event, so batching cannot be used to get round it.
    const limit = rateLimitCost(`events:${clientIp(request)}`, 240, 60_000, events.length)
    if (!limit.ok) {
      return new NextResponse(null, {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfter) },
      })
    }

    // Insert first and let the foreign key answer "does this book exist?".
    //
    // There used to be a `count` query against `books` before every insert,
    // which doubled the round trips on the hottest path in the product: a reader
    // flipping through a twenty-page edition fires a `page_view` per page and a
    // `page_click` per click, and each one was paying for a lookup whose only
    // possible answers the FK already enforces.
    // Analytics must never be the reason a reader sees a failure. Without a
    // service key there is nowhere to record to, so accept and drop rather than
    // 500 on every page view of every published edition.
    if (!hasServiceRoleKey()) {
      console.error('[events] SUPABASE_SERVICE_ROLE_KEY is not set — analytics is not being recorded.')
      return new NextResponse(null, { status: 204 })
    }

    // One statement for the whole batch.
    const { error: insertError } = await supabaseAdmin.from('events').insert(
      events.map((e) => ({
        book_id: e.bookId,
        session_id: e.sessionId,
        event_type: e.eventType,
        page_number: pageNumberOf(e),
        payload: e.payload ?? {},
      }))
    )

    if (insertError) {
      // 23503 = foreign_key_violation: no such book.
      if (insertError.code === '23503') {
        return NextResponse.json({ error: 'Book not found' }, { status: 404 })
      }
      // 23514 = check_violation, which for this table means the event_type
      // enum in Postgres is behind the one in the app. `gate_view` is the
      // live example — see supabase/migrations/009.
      if (insertError.code === '23514') {
        console.error(
          `[events] the events_event_type_check constraint rejects one of ` +
            `"${[...new Set(events.map((e) => e.eventType))].join('", "')}" — ` +
            'apply the pending migrations in supabase/migrations/'
        )
        return new NextResponse(null, { status: 204 })
      }
      console.error('events insert failed', insertError)
      return NextResponse.json({ error: 'Internal error' }, { status: 500 })
    }

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
