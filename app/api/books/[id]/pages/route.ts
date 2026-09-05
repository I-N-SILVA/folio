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

  const isOwner = await getOwner(id, user.id)
  if (!isOwner) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

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

  const rows = parsed.data.map((p) => ({
    ...p,
    book_id: id,
    blocks: p.blocks ?? [],
    hotspots: p.hotspots ?? [],
  }))

  // Replacing the page set has to be atomic. This route ran a DELETE and then
  // an INSERT as two separate round-trips, so every autosave — one every couple
  // of seconds while editing — briefly left the book with no pages, and
  // anything that stopped the INSERT landing made that permanent. See
  // 009's replace_book_pages for why the delete can't simply become an upsert.
  const { error: rpcError } = await supabaseAdmin.rpc('replace_book_pages', {
    p_book_id: id,
    p_pages: rows,
  })

  if (!rpcError) return new NextResponse(null, { status: 204 })

  // PGRST202 / 42883 mean 009 hasn't been applied. Rather than break
  // saving outright on such an install, fall back to the old two-statement path
  // — but snapshot the pages first so a failed insert can be put back.
  const missingFunction = rpcError.code === 'PGRST202' || rpcError.code === '42883'
  if (!missingFunction) {
    console.error('[pages] replace_book_pages failed:', rpcError)
    return NextResponse.json({ error: rpcError.message }, { status: 500 })
  }

  console.error(
    '[pages] replace_book_pages() is missing — apply supabase/migrations/009_post_audit_features.sql. ' +
      'Falling back to a non-atomic save.'
  )

  const { data: snapshot } = await supabaseAdmin.from('pages').select('*').eq('book_id', id)

  await supabaseAdmin.from('pages').delete().eq('book_id', id)

  if (rows.length > 0) {
    const { error } = await supabaseAdmin.from('pages').insert(rows)
    if (error) {
      // Best effort: the delete has already happened, so putting the previous
      // pages back is the difference between a failed save and a lost book.
      if (snapshot && snapshot.length > 0) {
        const { error: restoreError } = await supabaseAdmin.from('pages').insert(snapshot)
        if (restoreError) {
          console.error('[pages] save failed AND restore failed:', restoreError)
        }
      }
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
  }

  return new NextResponse(null, { status: 204 })
}
