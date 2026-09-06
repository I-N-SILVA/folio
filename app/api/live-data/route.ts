import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { readLiveValue } from '@/lib/live-data'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { DEMO_BOOKS } from '@/data/books'
import { getOwnerEntitlements } from '@/lib/entitlements'
import type { Block, Page } from '@/lib/book-schema'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/**
 * The current value behind one Data block.
 *
 * Readers are anonymous, so this cannot take a URL — it takes a block that
 * already exists in an edition, and reads the source off the stored block on the
 * server. That is the whole authorisation model: you may ask for the data in a
 * published edition, and nothing else. A caller cannot make the server fetch a
 * URL of their choosing, which is what an open proxy would be.
 *
 * An unpublished edition answers only to its owner, so an author can see live
 * values in the editor and in preview before anyone else can.
 */

function findBlock(pages: Page[], blockId: string): Block | null {
  for (const page of pages) {
    const found = page.blocks?.find((b) => b.id === blockId)
    if (found) return found
  }
  return null
}

/**
 * The demo editions are bundled JSON, not Supabase rows, so a database lookup
 * finds nothing for them — and three of the four carry a Data block. Without
 * this the gallery, which is the product's own shop window, would show "Offline"
 * on every live figure in it.
 */
function findDemoBlock(bookId: string, blockId: string): Block | null {
  const book = Object.values(DEMO_BOOKS).find((b) => b.id === bookId)
  if (!book) return null
  return findBlock((book.pages ?? []) as Page[], blockId)
}

export async function GET(request: NextRequest) {
  const bookId = request.nextUrl.searchParams.get('book')
  const blockId = request.nextUrl.searchParams.get('block')
  if (!bookId || !blockId) {
    return NextResponse.json({ error: 'book and block are required' }, { status: 400 })
  }

  // Generous, because a reader with several live figures on screen legitimately
  // asks several times — but not unbounded.
  const limit = rateLimit(`live-data:${clientIp(request)}`, 120, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  let block = findDemoBlock(bookId, blockId)
  // The bundled demo editions are ours, so there is no owner to check.
  let ownerId: string | null = null

  if (!block) {
    const { data: book } = await supabaseAdmin
      .from('books')
      .select('id, owner_id, settings, pages(id, blocks)')
      .eq('id', bookId)
      .single()

    if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })

    const published = Boolean((book.settings as { published?: boolean } | null)?.published)
    if (!published) {
      // A draft's data is the author's alone until they publish it.
      const supabase = await createServerSupabase()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || user.id !== book.owner_id) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 })
      }
    }

    ownerId = book.owner_id as string | null
    block = findBlock((book.pages ?? []) as Page[], blockId)
  }

  if (!block || block.type !== 'data') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }
  if (!block.source || !block.path) {
    return NextResponse.json({ error: 'This block has no source yet' }, { status: 409 })
  }

  // The landing page has sold live data as a paid feature since it existed and
  // nothing enforced it, so a free edition bound to a live source exactly like
  // a paid one. It is also the one entitlement with a real marginal cost — the
  // server fetches the author's source on their behalf, on a schedule, forever.
  //
  // Checked against the *owner's* plan, not the reader's: a reader is anonymous,
  // and it is the author who is on a plan.
  if (ownerId) {
    const entitlements = await getOwnerEntitlements(ownerId)
    if (!entitlements.liveData) {
      return NextResponse.json(
        { error: 'Live data is available on paid plans', code: 'plan_limit' },
        { status: 402 }
      )
    }
  }

  const result = await readLiveValue(block.source, block.path)

  return NextResponse.json(result, {
    // The server already caches for 30s; this lets a CDN absorb a burst of
    // readers on the same edition without going stale enough to notice.
    headers: { 'Cache-Control': 'public, max-age=0, s-maxage=15, stale-while-revalidate=60' },
  })
}
