import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin, hasServiceRoleKey } from '@/lib/supabase'
import { PageSchema } from '@/lib/book-schema'
import { z } from 'zod'
import { revalidateReader } from '@/lib/revalidate-reader'
import { AUTO_SNAPSHOT_GAP_MINUTES, VERSIONS_KEPT } from '@/lib/versions'

/**
 * The book's public address if this user owns it, `null` if they do not. The
 * slug comes back from the ownership check rather than a second query: a save
 * has to drop the reader's cached copy, and this route runs on every autosave.
 */
async function getOwnedSlug(bookId: string, userId: string): Promise<string | null> {
  const { data } = await supabaseAdmin
    .from('books')
    .select('id, slug')
    .eq('id', bookId)
    .eq('owner_id', userId)
    .single()
  return (data?.slug as string | undefined) ?? null
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const slug = await getOwnedSlug(id, user.id)
  if (!slug) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabase
    .from('pages')
    .select('*')
    .eq('book_id', id)
    .order('page_number')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function PUT(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // After the 401 — a signed-out caller has no business learning how this
  // deployment is configured — but before the ownership lookup, because that
  // lookup is what fails without a service key, and it fails as a 403 telling
  // the actual owner they do not own their own edition.
  if (!hasServiceRoleKey()) {
    console.error(
      '[pages] SUPABASE_SERVICE_ROLE_KEY is not set — saving cannot work on this deployment.'
    )
    return NextResponse.json(
      {
        error:
          'Saving is not configured on this deployment — the server is missing its Supabase service key.',
      },
      { status: 503 }
    )
  }

  const slug = await getOwnedSlug(id, user.id)
  if (!slug) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const body = await request.json()
  const parsed = z.array(PageSchema.omit({ book_id: true })).safeParse(body)
  if (!parsed.success) {
    // A 400 here reaches an author mid-sentence, so it has to name the page and
    // the field. `flatten()` on an array keys everything by index, which is how
    // "Could not save these pages" ended up being the whole story — the editor
    // showed that for a schema rejection, and the author had nothing to act on.
    const pages: unknown[] = Array.isArray(body) ? body : []
    const detail = parsed.error.issues.slice(0, 3).map((issue) => {
      const [index, ...rest] = issue.path
      const pageNumber =
        typeof index === 'number'
          ? ((pages[index] as { page_number?: number } | undefined)?.page_number ?? index + 1)
          : undefined
      const field = rest.join('.') || 'page'
      return pageNumber
        ? `page ${pageNumber} (${field}): ${issue.message}`
        : `${field}: ${issue.message}`
    })
    console.error('[pages] rejected a save:', JSON.stringify(parsed.error.issues.slice(0, 10)))
    return NextResponse.json(
      { error: `This edition could not be saved — ${detail.join('; ')}`, issues: parsed.error.issues },
      { status: 400 }
    )
  }

  const rows = parsed.data.map((p) => ({
    ...p,
    book_id: id,
    blocks: p.blocks ?? [],
    hotspots: p.hotspots ?? [],
  }))

  // A point in the edition's history, before this save overwrites the previous
  // one. Throttled in the database (018), so an autosave firing every couple of
  // seconds opens a new version roughly twice an hour rather than every time.
  // Best effort on purpose: history is a safety net, and failing to take a
  // snapshot must never be the reason somebody's work does not save.
  const versionSnapshot = await supabaseAdmin.rpc('snapshot_book_version', {
    p_book_id: id,
    p_label: null,
    p_min_gap: `${AUTO_SNAPSHOT_GAP_MINUTES} minutes`,
    p_keep: VERSIONS_KEPT,
  })
  if (
    versionSnapshot.error &&
    versionSnapshot.error.code !== '42P01' &&
    versionSnapshot.error.code !== 'PGRST202'
  ) {
    console.error('[pages] could not snapshot before saving:', versionSnapshot.error)
  }

  // Replacing the page set has to be atomic. This route ran a DELETE and then
  // an INSERT as two separate round-trips, so every autosave — one every couple
  // of seconds while editing — briefly left the book with no pages, and
  // anything that stopped the INSERT landing made that permanent. See
  // 009's replace_book_pages for why the delete can't simply become an upsert.
  const { error: rpcError } = await supabaseAdmin.rpc('replace_book_pages', {
    p_book_id: id,
    p_pages: rows,
  })

  if (!rpcError) {
    // The reader page is ISR. Without this the author's own edition shows them
    // the previous version for up to a minute after they save it.
    revalidateReader(slug)
    return new NextResponse(null, { status: 204 })
  }

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

  revalidateReader(slug)
  return new NextResponse(null, { status: 204 })
}
