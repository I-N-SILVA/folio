import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase-server'
import { ThemeSchema, BookSettingsSchema } from '@/lib/book-schema'

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

// A second page-replacement handler used to live here: `PUT /api/books/[id]`,
// which deleted every page and then inserted the new set as two unrelated
// statements — the exact data-loss shape that `supabase/migrations/010` and
// `PUT /api/books/[id]/pages` exist to prevent. Nothing called it, so it was a
// loaded gun pointed at whoever wired up saving next. Page replacement has one
// route now, and that route is transactional.

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
