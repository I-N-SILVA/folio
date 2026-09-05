import { NextRequest, NextResponse } from 'next/server'
import { EVENT_TYPES } from '@/lib/book-schema'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, clientIp } from '@/lib/rate-limit'

const EventBodySchema = z.object({
  bookId: z.string(),
  sessionId: z.string(),
  // One list, in lib/book-schema. See EVENT_TYPES for why.
  eventType: z.enum(EVENT_TYPES),
  pageNumber: z.number().int().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    // Analytics is unauthenticated by design (public readers). Throttle per IP
    // so a single client cannot flood the events table.
    const limit = rateLimit(`events:${clientIp(request)}`, 240, 60_000)
    if (!limit.ok) {
      return new NextResponse(null, {
        status: 429,
        headers: { 'Retry-After': String(limit.retryAfter) },
      })
    }

    const body = await request.json()
    const parsed = EventBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { bookId, sessionId, eventType, pageNumber, payload } = parsed.data

    // Insert first and let the foreign key answer "does this book exist?".
    //
    // There used to be a `count` query against `books` before every insert,
    // which doubled the round trips on the hottest path in the product: a reader
    // flipping through a twenty-page edition fires a `page_view` per page and a
    // `page_click` per click, and each one was paying for a lookup whose only
    // possible answers the FK already enforces.
    const { error: insertError } = await supabaseAdmin.from('events').insert({
      book_id: bookId,
      session_id: sessionId,
      event_type: eventType,
      page_number: pageNumber ?? null,
      payload: payload ?? {},
    })

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
          `[events] the events_event_type_check constraint rejects "${eventType}" — ` +
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
