import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  const bookId = formData.get('bookId') as string | null

  if (!file || !bookId) {
    return NextResponse.json({ error: 'file and bookId required' }, { status: 400 })
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
