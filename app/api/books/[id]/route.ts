import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase-server'
import { ThemeSchema, BookSettingsSchema, PageSchema } from '@/lib/book-schema'

// ─── PATCH /api/books/[id] — partial book update ─────────────────────────────

const PatchBookSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  theme: ThemeSchema.optional(),
  settings: BookSettingsSchema.optional(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: book } = await supabase
    .from('books')
    .select('id, owner_id')
    .eq('id', id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (book.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = PatchBookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('books')
    .update({
      ...parsed.data,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

// ─── PUT /api/books/[id] — replace all pages ─────────────────────────────────

const PutPagesSchema = z.object({
  pages: z.array(PageSchema),
})

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: book } = await supabase
    .from('books')
    .select('id, owner_id')
    .eq('id', id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (book.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = PutPagesSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Delete existing pages for this book, then insert new ones
  const { error: deleteError } = await supabase
    .from('pages')
    .delete()
    .eq('book_id', id)

  if (deleteError) {
    return NextResponse.json({ error: deleteError.message }, { status: 500 })
  }

  if (parsed.data.pages.length > 0) {
    const pagesPayload = parsed.data.pages.map((p) => ({
      id: p.id,
      book_id: id,
      page_number: p.page_number,
      type: p.type,
      layout: p.layout,
      background: p.background ?? null,
      blocks: p.blocks,
      hotspots: p.hotspots,
    }))

    const { error: insertError } = await supabase.from('pages').insert(pagesPayload)
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 })
    }
  }

  return NextResponse.json({ success: true, count: parsed.data.pages.length })
}

// ─── DELETE /api/books/[id] — remove book ────────────────────────────────────

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const supabase = await createServerSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Verify ownership
  const { data: book } = await supabase
    .from('books')
    .select('id, owner_id')
    .eq('id', id)
    .single()

  if (!book) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (book.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { error } = await supabase.from('books').delete().eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
