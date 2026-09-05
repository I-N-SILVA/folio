import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { checkBookQuota } from '@/lib/entitlements'
import { formatQuota } from '@/lib/plans'
import { duplicateNames } from '@/lib/duplicate-naming'
import type { Page, Block, Hotspot } from '@/lib/book-schema'

/**
 * Copy an edition — and, with `asTemplate`, save it as a starting point.
 *
 * "Save as template" and "duplicate" are the same operation with a different
 * name on the result, so they are the same route. A template is a normal
 * edition carrying `settings.isTemplate`; starting from one is this route
 * again, without the flag.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  const body = (await request.json().catch(() => null)) as { asTemplate?: boolean } | null
  const asTemplate = body?.asTemplate === true
  const supabase = await createServerSupabase()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 1. Quota check
  const quota = await checkBookQuota(user.id, user.email)
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `You've reached your plan's limit of ${formatQuota(quota.limit)} book${
          quota.limit === 1 ? '' : 's'
        }. Upgrade to create more editions.`,
        code: 'plan_limit',
      },
      { status: 403 }
    )
  }

  // 2. Fetch original book & pages
  const { data: original, error: fetchError } = await supabase
    .from('books')
    .select('*, pages(*)')
    .eq('id', id)
    .single()

  if (fetchError || !original) {
    return NextResponse.json({ error: 'Original edition not found' }, { status: 404 })
  }

  if (original.owner_id !== user.id) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 3. Create cloned book
  const { title: newTitle, slug: newSlug } = duplicateNames(original, asTemplate)

  const { data: newBook, error: insertBookError } = await supabase
    .from('books')
    .insert({
      title: newTitle,
      description: original.description ?? null,
      slug: newSlug,
      owner_id: user.id,
      theme: original.theme ?? { preset: 'ivory' },
      settings: {
        ...(original.settings ?? {}),
        published: false,
        unlisted: false,
        // Starting *from* a template gives an edition, not another template,
        // so the flag is set explicitly either way rather than inherited.
        isTemplate: asTemplate,
      },
    })
    .select()
    .single()

  if (insertBookError || !newBook) {
    return NextResponse.json(
      { error: insertBookError?.message || 'Could not create duplicate edition' },
      { status: 500 }
    )
  }

  // 4. Clone all pages
  const originalPages = (original.pages ?? []) as Page[]
  if (originalPages.length > 0) {
    const sortedPages = [...originalPages].sort((a, b) => a.page_number - b.page_number)
    const clonedPages = sortedPages.map((p) => ({
      id: randomUUID(),
      book_id: newBook.id,
      page_number: p.page_number,
      type: p.type,
      layout: p.layout,
      background: p.background ?? null,
      blocks: (p.blocks ?? []).map((b: Block) => ({ ...b, id: randomUUID() })),
      hotspots: (p.hotspots ?? []).map((h: Hotspot) => ({ ...h, id: randomUUID() })),
    }))

    const { error: insertPagesError } = await supabase.from('pages').insert(clonedPages)

    if (insertPagesError) {
      await supabase.from('books').delete().eq('id', newBook.id)
      return NextResponse.json(
        { error: insertPagesError.message || 'Could not duplicate edition pages' },
        { status: 500 }
      )
    }
  }

  return NextResponse.json(newBook, { status: 201 })
}
