import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export const dynamic = 'force-dynamic'

/** What reviewers have said about this edition. The author's view. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
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
    .from('book_comments')
    .select('id, page_number, author_name, body, resolved_at, created_at')
    .eq('book_id', id)
    .order('created_at', { ascending: true })

  if (error) {
    if (error.code === '42P01') return NextResponse.json({ comments: [], unavailable: true })
    console.error('[comments] list failed:', error)
    return NextResponse.json({ error: 'Could not read the comments.' }, { status: 500 })
  }

  return NextResponse.json({ comments: data ?? [] })
}
