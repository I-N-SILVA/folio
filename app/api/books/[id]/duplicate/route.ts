import { randomUUID } from 'node:crypto'
import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { checkBookQuota } from '@/lib/entitlements'
import { formatQuota } from '@/lib/plans'
import type { Page, Block, Hotspot } from '@/lib/book-schema'

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6)
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
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
  const newSlug = `${original.slug.slice(0, 80)}-copy-${randomSuffix()}`
  const newTitle = `${original.title} (Copy)`

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
