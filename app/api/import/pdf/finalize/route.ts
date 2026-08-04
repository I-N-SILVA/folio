import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { detectHotspots, analyzeBookSEO, isAiEnabled } from '@/lib/ai'
import { rateLimit } from '@/lib/rate-limit'
import { MAX_IMPORT_PAGES, pageNumberFromName, pageType, mapWithConcurrency } from '@/lib/import'

/** Parallel Gemini calls. High enough to matter, low enough not to get rate-limited. */
const AI_CONCURRENCY = 5

/** Pages of context the SEO pass looks at. */
const SEO_SAMPLE_PAGES = 3

export const maxDuration = 300 // AI enhancement runs here

/**
 * Completes a PDF import: reads back what the browser uploaded to storage and
 * turns it into page rows, optionally with AI hotspots and SEO metadata.
 *
 * Storage is the authority on which pages exist, not the request body. The
 * client could otherwise claim pages it never uploaded, and the honest failure
 * mode — a few uploads that didn't land — should produce a shorter book rather
 * than page records pointing at objects that aren't there.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = rateLimit(`pdf-finalize:${user.id}`, 20, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many requests. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  let body: { bookId?: unknown; aiEnhance?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const bookId = typeof body.bookId === 'string' ? body.bookId : ''
  const aiEnhance = body.aiEnhance === true

  if (!/^[0-9a-f-]{36}$/i.test(bookId)) {
    return NextResponse.json({ error: 'bookId is required' }, { status: 400 })
  }

  const { data: book } = await supabaseAdmin
    .from('books')
    .select('id, title, settings')
    .eq('id', bookId)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!book) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  // Finalising twice must not double the book. A retry after a network blip on
  // the response is the ordinary way this happens.
  const { count: existingPages } = await supabaseAdmin
    .from('pages')
    .select('id', { count: 'exact', head: true })
    .eq('book_id', bookId)

  if ((existingPages ?? 0) > 0) {
    return NextResponse.json({ bookId, pageCount: existingPages, alreadyFinalized: true })
  }

  // ── What actually landed in storage ────────────────────────────────────────
  const { data: objects, error: listError } = await supabaseAdmin.storage
    .from('folio-assets')
    .list(`books/${bookId}/pages`, { limit: MAX_IMPORT_PAGES + 1 })

  if (listError) {
    console.error('[pdf-finalize] Could not list uploaded pages:', listError)
    return NextResponse.json({ error: 'Could not read the uploaded pages.' }, { status: 500 })
  }

  const pageNumbers = (objects ?? [])
    .map((o) => pageNumberFromName(o.name))
    .filter((n): n is number => n !== null)
    .sort((a, b) => a - b)

  if (pageNumbers.length === 0) {
    // Nothing uploaded: drop the book rather than leave an empty one occupying
    // the author's slug and a slot against their plan quota.
    await supabaseAdmin.from('books').delete().eq('id', bookId)
    return NextResponse.json(
      { error: 'No pages were uploaded. Please try the import again.' },
      { status: 400 }
    )
  }

  const total = pageNumbers.length

  const publicUrlFor = (pageNumber: number) =>
    supabaseAdmin.storage
      .from('folio-assets')
      .getPublicUrl(`books/${bookId}/pages/page-${pageNumber}.png`).data.publicUrl

  // ── AI enhancement (optional, and only if a key is configured) ─────────────
  const hotspotsByPage = new Map<number, unknown[]>()
  let seoMetadata: { description: string; keywords: string } | undefined

  if (aiEnhance && isAiEnabled()) {
    // The images live in storage now rather than in this request, so the AI pass
    // reads them back. Bounded concurrency: at the 50-page ceiling, one awaited
    // Gemini call per page in series can outrun the function budget on its own.
    const buffers = await mapWithConcurrency(pageNumbers, AI_CONCURRENCY, async (pageNumber) => {
      const { data, error } = await supabaseAdmin.storage
        .from('folio-assets')
        .download(`books/${bookId}/pages/page-${pageNumber}.png`)
      if (error || !data) return null
      return { pageNumber, buffer: Buffer.from(await data.arrayBuffer()) }
    })

    const present = buffers.filter((b): b is NonNullable<typeof b> => b !== null)

    const detected = await mapWithConcurrency(present, AI_CONCURRENCY, ({ pageNumber, buffer }) =>
      detectHotspots(buffer, pageNumber).then((hotspots) => ({ pageNumber, hotspots }))
    )
    for (const { pageNumber, hotspots } of detected) {
      hotspotsByPage.set(pageNumber, hotspots)
    }

    const sample = present.slice(0, SEO_SAMPLE_PAGES).map((p) => p.buffer)
    if (sample.length > 0) {
      seoMetadata = await analyzeBookSEO(sample, book.title as string)
    }
  }

  // ── Page rows ─────────────────────────────────────────────────────────────
  // Numbered by position rather than by the storage name: if page 7's upload
  // failed, the remaining pages should close the gap instead of leaving a hole
  // that the reader renders as a missing spread.
  const pageRows = pageNumbers.map((pageNumber, idx) => ({
    id: uuidv4(),
    book_id: bookId,
    page_number: idx + 1,
    type: pageType(idx + 1, total),
    layout: 'blank',
    background: {},
    blocks: [
      {
        type: 'image',
        id: uuidv4(),
        src: publicUrlFor(pageNumber),
        alt: `Page ${idx + 1}`,
        lightbox: false,
      },
    ],
    hotspots: hotspotsByPage.get(pageNumber) ?? [],
  }))

  const { error: pagesError } = await supabaseAdmin.from('pages').insert(pageRows)

  if (pagesError) {
    console.error('[pdf-finalize] Failed to create pages:', pagesError)
    return NextResponse.json(
      { error: `Failed to create pages: ${pagesError.message}` },
      { status: 500 }
    )
  }

  if (seoMetadata) {
    const settings = (book.settings ?? {}) as Record<string, unknown>
    await supabaseAdmin
      .from('books')
      .update({ settings: { ...settings, seo: seoMetadata } })
      .eq('id', bookId)
  }

  return NextResponse.json({ bookId, pageCount: pageRows.length })
}
