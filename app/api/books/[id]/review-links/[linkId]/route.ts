import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/**
 * Revoke a review link.
 *
 * Marked rather than deleted, so the comments it produced keep pointing at
 * where they came from. `review_link_book` re-checks `revoked_at` on every
 * read, so this takes effect on the reviewer's next request rather than
 * whenever a cache expires.
 */
export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; linkId: string }> }
) {
  const { id, linkId } = await params
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: book } = await supabaseAdmin
    .from('books')
    .select('id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle()
  if (!book) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin
    .from('book_review_links')
    .update({ revoked_at: new Date().toISOString() })
    .eq('id', linkId)
    .eq('book_id', id)
    .select('id')
    .maybeSingle()

  if (error) {
    console.error('[review-links] revoke failed:', error)
    return NextResponse.json({ error: 'Could not revoke that link.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json({ revoked: true })
}
