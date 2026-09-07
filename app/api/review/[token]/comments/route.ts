import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'

export const dynamic = 'force-dynamic'

const CommentSchema = z.object({
  pageNumber: z.number().int().positive(),
  authorName: z.string().trim().min(1).max(60),
  body: z.string().trim().min(1).max(2000),
})

/**
 * A reviewer leaves a comment.
 *
 * The old review drawer kept what somebody typed in component state, so a
 * refresh threw it away — a feedback tool that loses feedback is worse than
 * none, because somebody trusted it. This writes it down before answering.
 *
 * The link the comment came through is recorded, so revoking a link can be
 * traced to what it produced.
 */
export async function POST(request: NextRequest, { params }: { params: Promise<{ token: string }> }) {
  const { token } = await params

  const limit = rateLimit(`review-comment:${token}`, 30, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many comments at once. Please wait a moment.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  const parsed = CommentSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'A name and a comment are required.' }, { status: 400 })
  }

  const { data: resolved } = await supabaseAdmin.rpc('review_link_book', { p_token: token })
  const link = Array.isArray(resolved) ? resolved[0] : null
  if (!link) {
    return NextResponse.json({ error: 'This review link is no longer active.' }, { status: 404 })
  }

  const { data, error } = await supabaseAdmin
    .from('book_comments')
    .insert({
      book_id: link.book_id,
      review_link_id: link.link_id,
      page_number: parsed.data.pageNumber,
      author_name: parsed.data.authorName,
      body: parsed.data.body,
    })
    .select('id, page_number, author_name, body, resolved_at, created_at')
    .single()

  if (error) {
    console.error('[review] could not save a comment:', error)
    return NextResponse.json({ error: 'Could not save that comment.' }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
