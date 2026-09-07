import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { revalidateReader } from '@/lib/revalidate-reader'

export const dynamic = 'force-dynamic'

/**
 * Put an edition back to one of its versions.
 *
 * `restore_book_version` snapshots the current state first — restoring is
 * itself a destructive edit, and somebody who picks the wrong version needs the
 * same way back out that brought them here.
 */
export async function POST(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string; versionId: string }> }
) {
  const { id, versionId } = await params
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: book } = await supabaseAdmin
    .from('books')
    .select('id, slug')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!book) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const { data, error } = await supabaseAdmin.rpc('restore_book_version', {
    p_book_id: id,
    p_version_id: versionId,
  })

  if (error) {
    if (error.code === '42P01' || error.code === 'PGRST202' || error.code === '42883') {
      return NextResponse.json(
        { error: 'Version history is not available on this deployment yet.' },
        { status: 503 }
      )
    }
    console.error('[versions] restore failed:', error)
    return NextResponse.json({ error: 'Could not restore that version.' }, { status: 500 })
  }

  const restored = Array.isArray(data) ? data[0] : null
  if (!restored) {
    return NextResponse.json(
      { error: 'That version is not part of this edition.' },
      { status: 404 }
    )
  }

  // A restore changes what a stranger sees at the public address.
  revalidateReader(book.slug as string)

  return NextResponse.json({ restoredFrom: restored.restored_from })
}
