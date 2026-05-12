import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { PageSchema } from '@/lib/book-schema'
import { z } from 'zod'

async function getOwner(bookId: string, userId: string) {
  const { data } = await supabaseAdmin
    .from('books')
    .select('id')
    .eq('id', bookId)
    .eq('owner_id', userId)
    .single()
  return !!data
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('book_id', id)
    .order('page_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const isOwner = await getOwner(id, user.id)
  if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = z.array(PageSchema.omit({ book_id: true })).safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Delete and re-insert all pages
  await supabaseAdmin.from('pages').delete().eq('book_id', id)

  if (parsed.data.length > 0) {
    const rows = parsed.data.map((p) => ({
      ...p,
      book_id: id,
      blocks: p.blocks ?? [],
      hotspots: p.hotspots ?? [],
    }))
    const { error } = await supabaseAdmin.from('pages').insert(rows)
    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
