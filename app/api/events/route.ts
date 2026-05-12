import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'

const EventBodySchema = z.object({
  bookId: z.string(),
  sessionId: z.string(),
  eventType: z.enum([
    'book_open',
    'page_view',
    'page_flip',
    'hotspot_click',
    'modal_open',
    'modal_close',
    'video_play',
    'video_complete',
    'audio_play',
    'cta_click',
    'book_complete',
  ]),
  pageNumber: z.number().int().optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
})

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const parsed = EventBodySchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
    }

    const { bookId, sessionId, eventType, pageNumber, payload } = parsed.data

    await supabaseAdmin.from('events').insert({
      book_id: bookId,
      session_id: sessionId,
      event_type: eventType,
      page_number: pageNumber ?? null,
      payload: payload ?? {},
    })

    return new NextResponse(null, { status: 204 })
  } catch {
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}
