import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { lockedPages } from '@/lib/gating'
import { getOwnerEntitlements, readerPolicy } from '@/lib/entitlements'
import { isEmailEnabled, sendLeadNotification } from '@/lib/email'
import { getDemoBook } from '@/data/books'
import type { Book } from '@/lib/book-schema'

/**
 * Exchanges an email for the pages past a lead gate.
 *
 * Readers are anonymous, so this is deliberately unauthenticated — but it only
 * ever serves pages from a published book whose gating is switched on, and only
 * the pages after the boundary. It is the single place those pages are
 * reachable; the reader's initial HTML never contains them.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://qlico.app'

/**
 * Emails the edition's owner about a new lead, if email is configured.
 *
 * The owner's address comes from their profile row rather than from anything in
 * the request, so a reader cannot direct where this goes.
 */
async function notifyOwner(book: Book, readerEmail: string): Promise<void> {
  if (!isEmailEnabled()) return

  const { data: owner } = await supabaseAdmin
    .from('profiles')
    .select('email')
    .eq('id', book.owner_id)
    .maybeSingle()

  const to = owner?.email
  if (!to) return

  await sendLeadNotification({
    to,
    editionTitle: book.title,
    readerEmail,
    editionUrl: `${SITE_URL}/book/${book.slug}`,
    insightsUrl: `${SITE_URL}/analytics/${book.slug}`,
  })
}

const UnlockSchema = z.object({
  slug: z.string().min(1).max(100),
  email: z.email(),
  sessionId: z.string().min(1).max(100),
})

export async function POST(request: NextRequest) {
  // The endpoint hands out content, so throttle harder than analytics does.
  const limit = rateLimit(`unlock:${clientIp(request)}`, 20, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many attempts. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  const parsed = UnlockSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
  }

  const { slug, email, sessionId } = parsed.data

  // Bundled demo editions have no rows to read or write.
  const demo = getDemoBook(slug)
  if (demo) {
    return NextResponse.json({ pages: lockedPages(demo) })
  }

  const { data, error } = await supabaseAdmin
    .from('books')
    .select('*, pages(*)')
    .eq('slug', slug)
    .eq('settings->>published', 'true')
    .maybeSingle()

  if (error || !data) {
    return NextResponse.json({ error: 'Edition not found.' }, { status: 404 })
  }

  const book = data as unknown as Book

  // Lead capture is a paid entitlement, and the toggle that switches it on is
  // written straight to the book row by the editor. Resolving the owner's plan
  // here keeps this endpoint consistent with the reader: if the plan doesn't
  // include gating, the reader served the whole edition and there is nothing
  // withheld for this request to release.
  const entitlements = await getOwnerEntitlements(book.owner_id)
  const { gateEnabled } = readerPolicy(book.settings, entitlements)
  if (!gateEnabled) {
    return NextResponse.json({ error: 'This edition is not gated.' }, { status: 400 })
  }

  if (book.pages) {
    book.pages.sort((a, b) => a.page_number - b.page_number)
  }

  // Record the lead before releasing anything. The email is the whole point of
  // the exchange, so a failure to capture it is a failure of the request —
  // previously this was a fire-and-forget analytics ping that could drop the
  // lead while still unlocking the content.
  const { error: eventError } = await supabaseAdmin.from('events').insert({
    book_id: book.id,
    session_id: sessionId,
    event_type: 'gate_unlock',
    page_number: book.settings.gating.page_number ?? 3,
    payload: { email, page_number: book.settings.gating.page_number ?? 3 },
  })

  if (eventError) {
    console.error('[unlock] failed to record lead:', eventError)
    return NextResponse.json(
      { error: "We couldn't save your email. Please try again." },
      { status: 500 }
    )
  }

  // Tell the author. A captured lead was the most valuable thing this product
  // produces and the hardest to find out about — it sat in the events table
  // until someone thought to open Insights and export a CSV.
  //
  // Deliberately after the lead is safely recorded and deliberately not awaited
  // into the response's success: the reader is owed their pages whether or not
  // an email provider is configured or reachable.
  notifyOwner(book, email).catch((err) => console.error('[unlock] notify failed:', err))

  return NextResponse.json({ pages: lockedPages(book, gateEnabled) })
}
