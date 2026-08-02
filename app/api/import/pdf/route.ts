import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { detectHotspots, analyzeBookSEO } from '@/lib/ai'
import { checkBookQuota } from '@/lib/entitlements'
import { formatQuota } from '@/lib/plans'
import { rateLimit } from '@/lib/rate-limit'

const MAX_PAGES = 50

/** Parallel Gemini calls. High enough to matter, low enough not to get rate-limited. */
const AI_CONCURRENCY = 5

export const maxDuration = 300 // 5 minutes for AI processing

/** Runs `fn` over `items` with at most `limit` in flight, preserving order. */
async function mapWithConcurrency<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  const results = new Array<R>(items.length)
  let cursor = 0

  async function worker() {
    while (cursor < items.length) {
      const index = cursor++
      results[index] = await fn(items[index], index)
    }
  }

  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, worker))
  return results
}

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // PDF import runs AI + storage work — keep it cheap to abuse.
  const limit = rateLimit(`pdf-import:${user.id}`, 10, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many imports. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  // ── Parse multipart form ────────────────────────────────────────────────────
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Invalid form data' }, { status: 400 })
  }

  const title = (formData.get('title') as string | null)?.trim()
  const slug = (formData.get('slug') as string | null)?.trim()
  const pageCount = parseInt(formData.get('pageCount') as string || '0', 10)
  const aiEnhance = formData.get('aiEnhance') === 'true'

  if (!title || !slug) {
    return NextResponse.json(
      { error: 'title and slug are required' },
      { status: 400 }
    )
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: 'Slug must be lowercase alphanumeric with hyphens only' },
      { status: 400 }
    )
  }

  // ── Enforce the plan quota before doing any expensive work ─────────────────
  // This route inserts with the service-role client, so the only thing that
  // used to stop an over-quota import was the DB trigger — which fires after
  // the PDF and every rendered page have already been uploaded, and surfaces
  // as a raw "BOOK_LIMIT_REACHED" Postgres error. Check up front instead, and
  // return the same shape /api/books does so clients can react to it.
  const quota = await checkBookQuota(user.id, user.email)
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `You've reached your plan's limit of ${formatQuota(quota.limit)} book${
          quota.limit === 1 ? '' : 's'
        }. Upgrade to import more.`,
        code: 'plan_limit',
        plan: quota.plan.id,
        used: quota.used,
        limit: Number.isFinite(quota.limit) ? quota.limit : null,
      },
      { status: 403 }
    )
  }

  // ── Check slug uniqueness ───────────────────────────────────────────────────
  // maybeSingle, not single: single() treats "no rows" as an error, which is
  // the expected case for a free slug.
  const { data: existingSlug } = await supabaseAdmin
    .from('books')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingSlug) {
    return NextResponse.json(
      { error: 'That slug is already taken. Choose a different one.' },
      { status: 409 }
    )
  }

  const bookId = uuidv4()

  // The source PDF used to be uploaded to books/<id>/source.pdf and its URL
  // returned in the response. Nothing ever read it — it wasn't stored on the
  // book record or referenced anywhere — so each import silently parked up to
  // 50 MB in storage forever, and shipped that same 50 MB up in the request
  // body on the way in. The client renders the pages; the server never needs
  // the original.

  // Everything written to storage for this import, so a failure at any later
  // step can remove all of it. Previously nothing cleaned up the page PNGs,
  // leaving up to 50 orphans behind on every failed import.
  const uploadedPaths: string[] = []
  const discardUploads = () =>
    supabaseAdmin.storage.from('folio-assets').remove(uploadedPaths)

  // ── Upload page images if provided (from client-side rendering) ────────────
  const pageImageUrls: string[] = []
  const pageHotspots: any[][] = []

  // Collect the client-rendered pages up front so uploads and AI analysis can
  // each run at their own pace instead of being interleaved one page at a time.
  const pageBuffers: ArrayBuffer[] = []
  for (let i = 0; i < MAX_PAGES; i++) {
    const pageFile = formData.get(`page_${i}`) as File | null
    if (!pageFile) break
    pageBuffers.push(await pageFile.arrayBuffer())
  }

  for (let i = 0; i < pageBuffers.length; i++) {
    const pagePath = `books/${bookId}/pages/page-${i + 1}.png`

    const { error: uploadError } = await supabaseAdmin.storage
      .from('folio-assets')
      .upload(pagePath, pageBuffers[i], {
        contentType: 'image/png',
        upsert: false,
      })

    if (uploadError) {
      console.error(`[pdf-import] Page ${i + 1} upload failed:`, uploadError)
      await discardUploads()
      return NextResponse.json(
        { error: `Failed to upload page ${i + 1}: ${uploadError.message}` },
        { status: 500 }
      )
    }

    uploadedPaths.push(pagePath)

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from('folio-assets').getPublicUrl(pagePath)
    pageImageUrls.push(publicUrl)
  }

  // Hotspot detection was one awaited Gemini call per page, in series. At the
  // 50-page ceiling that alone can outrun the 300s function budget, and the
  // whole import is lost with it. Run a bounded number at a time instead.
  if (aiEnhance && pageBuffers.length > 0) {
    const detected = await mapWithConcurrency(pageBuffers, AI_CONCURRENCY, (buf, i) =>
      detectHotspots(Buffer.from(buf), i + 1)
    )
    pageHotspots.push(...detected)
  }

  // Use the actual page count: either from uploaded images or from the client-provided count
  const totalPages = pageImageUrls.length || Math.min(pageCount, MAX_PAGES) || 1

  // AI Enhancement: Generate SEO Metadata
  let seoMetadata = undefined
  if (aiEnhance && pageBuffers.length > 0) {
    // First three pages are enough context, and they're already in memory —
    // this used to re-read and re-buffer them out of the form data.
    const buffers = pageBuffers.slice(0, 3).map((buf) => Buffer.from(buf))
    seoMetadata = await analyzeBookSEO(buffers, title)
  }

  // ── Create book record ──────────────────────────────────────────────────────
  const { error: bookError } = await supabaseAdmin.from('books').insert({
    id: bookId,
    slug,
    title,
    owner_id: user.id,
    theme: { preset: 'ivory' },
    settings: { published: false, unlisted: false, seo: seoMetadata },
  })

  if (bookError) {
    console.error('[pdf-import] Failed to create book:', bookError)
    await discardUploads()
    // 23505 = unique_violation — the slug was taken between our check and insert.
    if (bookError.code === '23505') {
      return NextResponse.json(
        { error: 'That slug is already taken. Choose a different one.' },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: `Failed to create book: ${bookError.message}` },
      { status: 500 }
    )
  }

  // ── Create page records ─────────────────────────────────────────────────────
  const pageRows = Array.from({ length: totalPages }, (_, idx) => ({
    id: uuidv4(),
    book_id: bookId,
    page_number: idx + 1,
    type: idx === 0 ? 'cover' : idx === totalPages - 1 ? 'back' : 'content',
    layout: 'blank',
    background: {},
    blocks: pageImageUrls[idx]
      ? [
          {
            type: 'image',
            id: uuidv4(),
            src: pageImageUrls[idx],
            alt: `Page ${idx + 1}`,
            lightbox: false,
          },
        ]
      : [],
    hotspots: pageHotspots[idx] || [],
  }))

  const { error: pagesError } = await supabaseAdmin.from('pages').insert(pageRows)

  if (pagesError) {
    console.error('[pdf-import] Failed to create pages:', pagesError)
    await supabaseAdmin.from('books').delete().eq('id', bookId)
    await discardUploads()
    return NextResponse.json(
      { error: `Failed to create pages: ${pagesError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    bookId,
    slug,
    pageCount: totalPages,
  })
}
