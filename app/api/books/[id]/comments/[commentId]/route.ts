import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

const PatchSchema = z.object({ resolved: z.boolean() })

/**
 * Resolve or reopen a comment.
 *
 * Only the author. Resolving is a judgement about the work — whether the note
 * has been acted on — and a reviewer holding a link is not the person who makes
 * it. Reopening exists because "done" is sometimes wrong.
 */
export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; commentId: string }> }
) {
  const { id, commentId } = await params
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

  const parsed = PatchSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const { data, error } = await supabaseAdmin
    .from('book_comments')
    .update({ resolved_at: parsed.data.resolved ? new Date().toISOString() : null })
    .eq('id', commentId)
    .eq('book_id', id)
    .select('id, resolved_at')
    .maybeSingle()

  if (error) {
    console.error('[comments] update failed:', error)
    return NextResponse.json({ error: 'Could not update that comment.' }, { status: 500 })
  }
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return NextResponse.json(data)
}
