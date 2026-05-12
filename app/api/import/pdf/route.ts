import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'

// pdfjs legacy build works in Node.js without a browser worker
import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist/legacy/build/pdf.mjs'
import type { PDFDocumentProxy } from 'pdfjs-dist/types/src/display/api'
import { createCanvas } from '@napi-rs/canvas'

// Disable worker — not needed in Node.js
;(GlobalWorkerOptions as any).workerSrc = ''

const MAX_PAGES = 50
const SCALE = 1.5

export const maxDuration = 60 // seconds — PDF processing is slow

export async function POST(request: NextRequest) {
  // ── Auth ────────────────────────────────────────────────────────────────────
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
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

  if (!file || !title || !slug) {
    return NextResponse.json(
      { error: 'file, title, and slug are required' },
      { status: 400 }
    )
  }

  if (!file.type.includes('pdf') && !file.name.toLowerCase().endsWith('.pdf')) {
    return NextResponse.json({ error: 'File must be a PDF' }, { status: 400 })
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

  // ── Load PDF ────────────────────────────────────────────────────────────────
  let pdfBytes: ArrayBuffer
  try {
    pdfBytes = await file.arrayBuffer()
  } catch {
    return NextResponse.json({ error: 'Failed to read file' }, { status: 400 })
  }

  let pdf!: PDFDocumentProxy
  try {
    pdf = await getDocument({ data: new Uint8Array(pdfBytes) }).promise
  } catch (err) {
    console.error('[pdf-import] Failed to parse PDF:', err)
    return NextResponse.json(
      { error: 'Failed to parse PDF. Make sure it is a valid, non-encrypted PDF.' },
      { status: 422 }
    )
  }

  const numPages = Math.min(pdf.numPages, MAX_PAGES)
  const bookId = uuidv4()

  // ── Render pages and upload to Storage ─────────────────────────────────────
  const pageImageUrls: string[] = []

  for (let i = 1; i <= numPages; i++) {
    try {
      const page = await pdf.getPage(i)
      const viewport = page.getViewport({ scale: SCALE })
      const canvas = createCanvas(viewport.width, viewport.height)

      await page.render({
        canvas: canvas as unknown as HTMLCanvasElement,
        viewport,
      }).promise

      const buffer = canvas.toBuffer('image/png')
      const storagePath = `books/${bookId}/pages/page-${i}.png`

      const { error: uploadError } = await supabaseAdmin.storage
        .from('folio-assets')
        .upload(storagePath, buffer, {
          contentType: 'image/png',
          upsert: false,
        })

      if (uploadError) {
        console.error(`[pdf-import] Upload failed for page ${i}:`, uploadError)
        throw new Error(`Storage upload failed: ${uploadError.message}`)
      }

      const {
        data: { publicUrl },
      } = supabaseAdmin.storage.from('folio-assets').getPublicUrl(storagePath)

      pageImageUrls.push(publicUrl)

      // Release page resources
      page.cleanup()
    } catch (err) {
      console.error(`[pdf-import] Error processing page ${i}:`, err)
      // Clean up any already-uploaded pages before returning error
      await supabaseAdmin.storage
        .from('folio-assets')
        .remove(pageImageUrls.map((_, idx) => `books/${bookId}/pages/page-${idx + 1}.png`))
      return NextResponse.json(
        { error: `Failed to process page ${i}: ${(err as Error).message}` },
        { status: 500 }
      )
    }
  }

  // ── Create book record ──────────────────────────────────────────────────────
  const { error: bookError } = await supabaseAdmin.from('books').insert({
    id: bookId,
    slug,
    title,
    owner_id: user.id,
    theme: { preset: 'ivory' },
    settings: { published: false, unlisted: false },
  })

  if (bookError) {
    console.error('[pdf-import] Failed to create book:', bookError)
    // Clean up storage
    await supabaseAdmin.storage
      .from('folio-assets')
      .remove(pageImageUrls.map((_, idx) => `books/${bookId}/pages/page-${idx + 1}.png`))
    return NextResponse.json(
      { error: `Failed to create book: ${bookError.message}` },
      { status: 500 }
    )
  }

  // ── Create page records ─────────────────────────────────────────────────────
  const pageRows = pageImageUrls.map((imageUrl, idx) => ({
    id: uuidv4(),
    book_id: bookId,
    page_number: idx + 1,
    type: idx === 0 ? 'cover' : idx === pageImageUrls.length - 1 ? 'back' : 'content',
    layout: 'blank',
    background: {},
    blocks: [
      {
        type: 'image',
        id: uuidv4(),
        src: imageUrl,
        alt: `Page ${idx + 1}`,
        lightbox: false,
      },
    ],
    hotspots: [],
  }))

  const { error: pagesError } = await supabaseAdmin.from('pages').insert(pageRows)

  if (pagesError) {
    console.error('[pdf-import] Failed to create pages:', pagesError)
    // Attempt book cleanup
    await supabaseAdmin.from('books').delete().eq('id', bookId)
    await supabaseAdmin.storage
      .from('folio-assets')
      .remove(pageImageUrls.map((_, idx) => `books/${bookId}/pages/page-${idx + 1}.png`))
    return NextResponse.json(
      { error: `Failed to create pages: ${pagesError.message}` },
      { status: 500 }
    )
  }

  return NextResponse.json({ bookId, slug, pageCount: pageImageUrls.length })
}
