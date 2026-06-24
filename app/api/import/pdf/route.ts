import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { detectHotspots, analyzeBookSEO } from '@/lib/ai'
import { rateLimit } from '@/lib/rate-limit'
import { MAX_PDF_BYTES, humanBytes } from '@/lib/uploads'

const MAX_PAGES = 50

export const maxDuration = 300 // 5 minutes for AI processing

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

  const file = formData.get('file') as File | null
  const title = (formData.get('title') as string | null)?.trim()
  const slug = (formData.get('slug') as string | null)?.trim()
  const pageCount = parseInt(formData.get('pageCount') as string || '0', 10)
  const aiEnhance = formData.get('aiEnhance') === 'true'

  if (!file || !title || !slug) {
    return NextResponse.json(
      { error: 'file, title, and slug are required' },
      { status: 400 }
    )
  }

  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
  }

  if (file.size > MAX_PDF_BYTES) {
    return NextResponse.json(
      { error: `PDF too large. Maximum size is ${humanBytes(MAX_PDF_BYTES)}.` },
      { status: 413 }
    )
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: 'Slug must be lowercase alphanumeric with hyphens only' },
      { status: 400 }
    )
  }

  // ── Check slug uniqueness ───────────────────────────────────────────────────
  const { data: existingSlug } = await supabaseAdmin
    .from('books')
    .select('id')
    .eq('slug', slug)
    .single()

  if (existingSlug) {
    return NextResponse.json(
      { error: 'That slug is already taken. Choose a different one.' },
      { status: 409 }
    )
  }

  const bookId = uuidv4()

  // ── Upload the raw PDF to storage ──────────────────────────────────────────
  let pdfBytes: ArrayBuffer
  try {
    pdfBytes = await file.arrayBuffer()
  } catch {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 400 })
  }

  const pdfPath = `books/${bookId}/source.pdf`
  const { error: pdfUploadError } = await supabaseAdmin.storage
    .from('folio-assets')
    .upload(pdfPath, pdfBytes, {
      contentType: 'application/pdf',
      upsert: false,
    })

  if (pdfUploadError) {
    console.error('[pdf-import] PDF upload failed:', pdfUploadError)
    return NextResponse.json(
      { error: `Failed to upload PDF: ${pdfUploadError.message}` },
      { status: 500 }
    )
  }

  const {
    data: { publicUrl: pdfPublicUrl },
  } = supabaseAdmin.storage.from('folio-assets').getPublicUrl(pdfPath)

  // ── Upload page images if provided (from client-side rendering) ────────────
  const pageImageUrls: string[] = []
  const pageHotspots: any[][] = []

  // Check for pre-rendered page images from the client
  for (let i = 0; i < MAX_PAGES; i++) {
    const pageFile = formData.get(`page_${i}`) as File | null
    if (!pageFile) break

    const pagePath = `books/${bookId}/pages/page-${i + 1}.png`
    const pageBytes = await pageFile.arrayBuffer()

    // AI Enhancement: Detect hotspots
    let detected: any[] = []
    if (aiEnhance) {
      detected = await detectHotspots(Buffer.from(pageBytes), i + 1)
    }
    pageHotspots.push(detected)

    const { error: uploadError } = await supabaseAdmin.storage
      .from('folio-assets')
      .upload(pagePath, pageBytes, {
        contentType: 'image/png',
        upsert: false,
      })

    if (uploadError) {
      console.error(`[pdf-import] Page ${i + 1} upload failed:`, uploadError)
      // Clean up and bail
      await supabaseAdmin.storage
        .from('folio-assets')
        .remove([pdfPath, ...pageImageUrls.map((_, idx) => `books/${bookId}/pages/page-${idx + 1}.png`)])
      return NextResponse.json(
        { error: `Failed to upload page ${i + 1}: ${uploadError.message}` },
        { status: 500 }
      )
    }

    const {
      data: { publicUrl },
    } = supabaseAdmin.storage.from('folio-assets').getPublicUrl(pagePath)
    pageImageUrls.push(publicUrl)
  }

  // Use the actual page count: either from uploaded images or from the client-provided count
  const totalPages = pageImageUrls.length || Math.min(pageCount, MAX_PAGES) || 1

  // AI Enhancement: Generate SEO Metadata
  let seoMetadata = undefined
  if (aiEnhance && pageImageUrls.length > 0) {
    // Pass the first up to 3 pages for context
    const limit = Math.min(pageImageUrls.length, 3)
    const buffers = []
    for (let i = 0; i < limit; i++) {
      const pageFile = formData.get(`page_${i}`) as File | null
      if (pageFile) {
        buffers.push(Buffer.from(await pageFile.arrayBuffer()))
      }
    }
    if (buffers.length > 0) {
      seoMetadata = await analyzeBookSEO(buffers, title)
    }
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
    await supabaseAdmin.storage
      .from('folio-assets')
      .remove([pdfPath])
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
    await supabaseAdmin.storage
      .from('folio-assets')
      .remove([pdfPath])
    return NextResponse.json(
      { error: `Failed to create pages: ${pagesError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({
    bookId,
    slug,
    pageCount: totalPages,
    pdfUrl: pdfPublicUrl,
  })
}
