import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { lockedPages } from '@/lib/gating'
import { getOwnerEntitlements, readerPolicy } from '@/lib/entitlements'
import { isEmailEnabled, sendLeadNotification } from '@/lib/email'
import { dispatchLeadWebhook } from '@/lib/webhooks'
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
  email: z.string().email().optional(),
  passcode: z.string().optional(),
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
    return NextResponse.json({ error: 'Valid credentials are required.' }, { status: 400 })
  }

  const { slug, email, passcode, sessionId } = parsed.data

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

  const entitlements = await getOwnerEntitlements(book.owner_id)
  const { gateEnabled } = readerPolicy(book.settings, entitlements)
  if (!gateEnabled) {
    return NextResponse.json({ error: 'This edition is not gated.' }, { status: 400 })
  }

  const gating = book.settings.gating

  // 1. Passcode verification
  if (gating?.type === 'passcode') {
    if (!passcode || passcode !== gating.passcode) {
      return NextResponse.json({ error: 'Incorrect passcode. Access denied.' }, { status: 403 })
    }
  } else if (gating?.type === 'domain') {
    // 2. Domain restriction verification
    if (!email) {
      return NextResponse.json({ error: 'Corporate email required.' }, { status: 400 })
    }
    const domain = email.split('@')[1]?.toLowerCase()
    const allowed = gating.allowedDomains?.map((d) => d.toLowerCase().replace(/^@/, '')) || []
    if (allowed.length > 0 && (!domain || !allowed.includes(domain))) {
      return NextResponse.json(
        { error: `Access restricted to authorized domains (${allowed.join(', ')}).` },
        { status: 403 }
      )
    }
  } else {
    // 3. Default email lead capture
    if (!email) {
      return NextResponse.json({ error: 'A valid email is required.' }, { status: 400 })
    }
  }

  if (book.pages) {
    book.pages.sort((a, b) => a.page_number - b.page_number)
  }

  // Record the lead if email was supplied
  if (email) {
    const { error: eventError } = await supabaseAdmin.from('events').insert({
      book_id: book.id,
      session_id: sessionId,
      event_type: 'gate_unlock',
      page_number: book.settings.gating.page_number ?? 3,
      payload: { email, page_number: book.settings.gating.page_number ?? 3 },
    })

    if (eventError) {
      console.error('[unlock] failed to record lead:', eventError)
    }

    notifyOwner(book, email).catch((err) => console.error('[unlock] notify failed:', err))
    dispatchLeadWebhook(book, email, sessionId).catch((err) => console.error('[unlock] webhook dispatch failed:', err))
  }

  return NextResponse.json({ pages: lockedPages(book, gateEnabled) })
}
