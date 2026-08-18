import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { ThemeSchema, BookSettingsSchema } from '@/lib/book-schema'

// ─── PATCH /api/books/[id] — partial book update ─────────────────────────────

const PatchBookSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  description: z.string().optional(),
  theme: ThemeSchema.optional(),
  settings: BookSettingsSchema.optional(),
  /** The public address. Changing it files the old one for forwarding. */
  slug: z
    .string()
    .min(1)
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Use lowercase letters, numbers and hyphens.')
    .optional(),
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

  // Verify ownership. The current slug comes along because a rename has to file
  // the address it is replacing.
  const { data: current } = await supabase
    .from('books')
    .select('id, owner_id, slug')
    .eq('id', id)
    .single()

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (current.owner_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = PatchBookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // A rename of the public address. The slug used to be permanent because
  // nothing could forward the old one, which made a typo in a link forever —
  // and the link is what goes in emails, on cards, into a client's CMS.
  //
  // The old slug is filed *before* the new one is taken, so a failure leaves the
  // edition reachable at its original address rather than at neither. The
  // history table's primary key is also what refuses a slug some other edition
  // has already released: taking it would silently hijack their old links.
  const renaming = parsed.data.slug !== undefined && parsed.data.slug !== current.slug

  if (renaming) {
    const claimed = await supabaseAdmin
      .from('book_slug_history')
      .select('book_id')
      .eq('slug', parsed.data.slug!)
      .maybeSingle()

    if (claimed.data && claimed.data.book_id !== id) {
      return NextResponse.json(
        { error: 'That link belonged to another edition. Choose a different one.', code: 'slug_taken' },
        { status: 409 }
      )
    }

    const filed = await supabaseAdmin
      .from('book_slug_history')
      .upsert({ slug: current.slug, book_id: id }, { onConflict: 'slug' })

    if (filed.error) {
      // 42P01 = undefined_table: migration 014 hasn't been applied. Refuse the
      // rename rather than performing one that silently breaks every link
      // already in circulation.
      if (filed.error.code === '42P01') {
        console.error(
          '[books] book_slug_history is missing — apply supabase/migrations/014_slug_history.sql'
        )
        return NextResponse.json(
          { error: 'Changing an edition’s link is not available on this deployment yet.' },
          { status: 503 }
        )
      }
      console.error('[books] could not file the old slug:', filed.error)
      return NextResponse.json({ error: 'Could not change the link.' }, { status: 500 })
    }
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

  if (error) {
    // 23505 = unique_violation on the slug: another edition holds it right now.
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'That link is already taken. Choose a different one.', code: 'slug_taken' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
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
