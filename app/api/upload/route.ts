import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { rateLimit } from '@/lib/rate-limit'
import { MAX_ASSET_BYTES, isAllowedAssetType, humanBytes } from '@/lib/uploads'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Throttle per user: uploads are expensive (storage + bandwidth).
  const limit = rateLimit(`upload:${user.id}`, 60, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many uploads. Please slow down.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const bookId = formData.get('bookId') as string | null

  if (!file || !bookId) {
    return NextResponse.json({ error: 'file and bookId required' }, { status: 400 })
  }

  if (file.size > MAX_ASSET_BYTES) {
    return NextResponse.json(
      { error: `File too large. Maximum size is ${humanBytes(MAX_ASSET_BYTES)}.` },
      { status: 413 }
    )
  }

  if (!isAllowedAssetType(file.type)) {
    return NextResponse.json(
      { error: 'Unsupported file type. Upload an image, video, or audio file.' },
      { status: 415 }
    )
  }

  // Verify ownership
  const { data: book } = await supabaseAdmin
    .from('books')
    .select('id')
    .eq('id', bookId)
    .eq('owner_id', user.id)
    .single()

  if (!book) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const ext = file.name.split('.').pop()
  const path = `books/${bookId}/assets/${crypto.randomUUID()}.${ext}`
  const bytes = await file.arrayBuffer()

  const { error } = await supabaseAdmin.storage
    .from('folio-assets')
    .upload(path, bytes, { contentType: file.type, upsert: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const { data: { publicUrl } } = supabaseAdmin.storage
    .from('folio-assets')
    .getPublicUrl(path)

  return NextResponse.json({ url: publicUrl })
}
