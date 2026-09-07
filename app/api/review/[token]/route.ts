import { NextRequest, NextResponse } from 'next/server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

/**
 * What a review link opens.
 *
 * The token is the whole credential, so this route is the boundary: it resolves
 * the token to exactly one edition and returns that edition and its comments,
 * and nothing else. No list of the author's editions, no analytics, no other
 * edition's comments.
 *
 * Rate limited on the token because it is guessable in principle — 32 bytes
 * means it is not guessable in practice, but a credential in a URL that answers
 * unboundedly is a credential worth grinding.
 */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const limit = rateLimit(`review:${token}`, 120, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  const { data: resolved, error: resolveError } = await supabaseAdmin.rpc('review_link_book', {
    p_token: token,
  })

  if (resolveError) {
    if (resolveError.code === 'PGRST202' || resolveError.code === '42883') {
      return NextResponse.json({ error: 'Review links are not available here.' }, { status: 503 })
    }
    console.error('[review] could not resolve token:', resolveError)
    return NextResponse.json({ error: 'Could not open that link.' }, { status: 500 })
  }

  const link = Array.isArray(resolved) ? resolved[0] : null
  // Revoked, expired and never-existed are one answer on purpose: telling them
  // apart tells somebody holding a guessed token that it was once real.
  if (!link) {
    return NextResponse.json({ error: 'This review link is no longer active.' }, { status: 404 })
  }

  const { data: book } = await supabaseAdmin
    .from('books')
    .select('id, title, description, theme, settings, pages(*)')
    .eq('id', link.book_id)
    .maybeSingle()

  if (!book) {
    return NextResponse.json({ error: 'This edition is no longer available.' }, { status: 404 })
  }

  if (Array.isArray(book.pages)) {
    ;(book.pages as { page_number: number }[]).sort((a, b) => a.page_number - b.page_number)
  }

  const { data: comments } = await supabaseAdmin
    .from('book_comments')
    .select('id, page_number, author_name, body, resolved_at, created_at')
    .eq('book_id', link.book_id)
    .order('created_at', { ascending: true })

  return NextResponse.json({
    // A reviewer is looking at a draft, so the gate and the plan's reader
    // policy are deliberately not applied — this is not the public reader.
    book,
    comments: comments ?? [],
  })
}
