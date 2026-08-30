import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { v4 as uuidv4 } from 'uuid'
import { checkBookQuota } from '@/lib/entitlements'
import { formatQuota } from '@/lib/plans'
import { rateLimit } from '@/lib/rate-limit'
import { MAX_IMPORT_PAGES, pagePath, mapWithConcurrency } from '@/lib/import'

export const maxDuration = 60

/**
 * Begins a PDF import.
 *
 * This route used to receive every rendered page in one multipart body, and
 * that was the largest single thing standing between the importer and working
 * at all: fifty pages of PNG at render scale 2 runs to tens of megabytes, while
 * serverless request bodies are capped an order of magnitude below that. The
 * client compensated by refusing to start when its own payload estimate passed
 * 40 MB and telling the author to split the PDF — which is to say the feature
 * declined to import the documents it existed for.
 *
 * So the pages no longer travel through here. This creates the book, claims the
 * slug, and returns one signed upload target per page; the browser writes the
 * images straight to storage, and /api/import/pdf/finalize turns whatever
 * landed into page rows. Nothing in the path is bounded by request-body size or
 * by one function's duration any more.
 */
export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const limit = rateLimit(`pdf-import:${user.id}`, 10, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many imports. Please wait a moment and try again.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  let body: { title?: unknown; slug?: unknown; pageCount?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const title = typeof body.title === 'string' ? body.title.trim() : ''
  const slug = typeof body.slug === 'string' ? body.slug.trim() : ''
  const pageCount = Number(body.pageCount)

  if (!title || !slug) {
    return NextResponse.json({ error: 'title and slug are required' }, { status: 400 })
  }

  if (!/^[a-z0-9-]+$/.test(slug)) {
    return NextResponse.json(
      { error: 'Slug must be lowercase alphanumeric with hyphens only' },
      { status: 400 }
    )
  }

  if (!Number.isInteger(pageCount) || pageCount < 1 || pageCount > MAX_IMPORT_PAGES) {
    return NextResponse.json(
      { error: `pageCount must be between 1 and ${MAX_IMPORT_PAGES}` },
      { status: 400 }
    )
  }

  // Enforce the plan quota before doing expensive work. The DB trigger enforces
  // it too, but only once the book row is attempted, and it surfaces as a raw
  // BOOK_LIMIT_REACHED error rather than something a client can act on.
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

  const bookId = uuidv4()

  // The book is created up front now rather than after the uploads, so the slug
  // is claimed before the author spends minutes uploading — two imports racing
  // for one slug previously only found out at the very end. The insert is what
  // decides it: the unique constraint arbitrates, not a prior SELECT.
  const { error: bookError } = await supabaseAdmin.from('books').insert({
    id: bookId,
    slug,
    title,
    owner_id: user.id,
    theme: { preset: 'ivory' },
    settings: { published: false, unlisted: false },
  })

  if (bookError) {
    // 23505 = unique_violation on the slug.
    if (bookError.code === '23505') {
      return NextResponse.json(
        { error: 'That slug is already taken. Choose a different one.' },
        { status: 409 }
      )
    }
    console.error('[pdf-import] Failed to create book:', bookError)
    return NextResponse.json(
      { error: `Failed to create book: ${bookError.message}` },
      { status: 500 }
    )
  }

  // Ensure storage bucket is provisioned
  const { ensureFolioBucket } = await import('@/lib/supabase')
  await ensureFolioBucket()

  // One signed target per page. The paths are server-chosen, so holding these
  // tokens lets the client write the pages of this book and nothing else.
  const pageNumbers = Array.from({ length: pageCount }, (_, i) => i + 1)
  let lastStorageError: string | null = null
  const uploads = await mapWithConcurrency(pageNumbers, 10, async (pageNumber) => {
    const { data, error } = await supabaseAdmin.storage
      .from('folio-assets')
      .createSignedUploadUrl(pagePath(bookId, pageNumber))
    if (error || !data) {
      lastStorageError = error?.message ?? 'Unknown storage error'
      console.error(`[pdf-import] Failed to create signed URL for page ${pageNumber}:`, error)
      return null
    }
    return { pageNumber, path: data.path, token: data.token }
  })

  const granted = uploads.filter((u): u is NonNullable<typeof u> => u !== null)

  if (granted.length !== pageCount) {
    // Without every target the import can't complete, and a half-written book is
    // worse than none — roll it back so the slug and the quota slot are freed.
    await supabaseAdmin.from('books').delete().eq('id', bookId)
    console.error('[pdf-import] Upload grant mismatch:', { granted: granted.length, expected: pageCount, lastError: lastStorageError })
    return NextResponse.json(
      { error: `Could not prepare upload storage (${lastStorageError || 'please check Supabase storage configuration'}).` },
      { status: 500 }
    )
  }

  return NextResponse.json({ bookId, slug, uploads: granted })
}
