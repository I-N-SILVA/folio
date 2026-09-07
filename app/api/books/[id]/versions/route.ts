import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { AUTO_SNAPSHOT_GAP_MINUTES, VERSIONS_KEPT } from '@/lib/versions'

export const dynamic = 'force-dynamic'

/**
 * An edition's history.
 *
 * Ownership is checked here rather than left to RLS on `book_versions`: the
 * snapshot and restore functions are `SECURITY DEFINER` and granted to
 * `service_role` only, so nothing below this route enforces who is asking.
 */
async function ownedBook(id: string) {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) }

  const { data } = await supabaseAdmin
    .from('books')
    .select('id')
    .eq('id', id)
    .eq('owner_id', user.id)
    .maybeSingle()

  if (!data) return { error: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) }
  return { user }
}

/** 42P01 = undefined_table: 018 has not been applied on this deployment. */
function missingTable(error: { code?: string } | null) {
  return error?.code === '42P01' || error?.code === 'PGRST202' || error?.code === '42883'
}

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owned = await ownedBook(id)
  if ('error' in owned) return owned.error

  const { data, error } = await supabaseAdmin
    .from('book_versions')
    .select('id, created_at, label, pages')
    .eq('book_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    // An install without 018 has no history rather than a broken editor.
    if (missingTable(error)) return NextResponse.json({ versions: [], unavailable: true })
    console.error('[versions] list failed:', error)
    return NextResponse.json({ error: 'Could not read this edition’s history.' }, { status: 500 })
  }

  // The pages themselves are the bulk of a row and nothing lists them, so they
  // are counted here and dropped rather than shipped to the browser.
  return NextResponse.json({
    versions: (data ?? []).map((v) => ({
      id: v.id,
      created_at: v.created_at,
      label: v.label,
      pageCount: Array.isArray(v.pages) ? v.pages.length : 0,
    })),
    keeps: VERSIONS_KEPT,
    autoGapMinutes: AUTO_SNAPSHOT_GAP_MINUTES,
  })
}

const SnapshotSchema = z.object({
  /** Naming one makes it findable, and bypasses the automatic throttle. */
  label: z.string().trim().min(1).max(80).optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owned = await ownedBook(id)
  if ('error' in owned) return owned.error

  const parsed = SnapshotSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid body' }, { status: 400 })
  }

  const { data, error } = await supabaseAdmin.rpc('snapshot_book_version', {
    p_book_id: id,
    p_label: parsed.data.label ?? null,
    p_min_gap: `${AUTO_SNAPSHOT_GAP_MINUTES} minutes`,
    p_keep: VERSIONS_KEPT,
  })

  if (error) {
    if (missingTable(error)) {
      return NextResponse.json(
        { error: 'Version history is not available on this deployment yet.' },
        { status: 503 }
      )
    }
    console.error('[versions] snapshot failed:', error)
    return NextResponse.json({ error: 'Could not save a version.' }, { status: 500 })
  }

  // No rows means the throttle declined — the previous version is recent
  // enough. That is a normal outcome for an automatic snapshot, not a failure.
  const created = Array.isArray(data) ? data[0] : null
  return NextResponse.json({ created: created ?? null, throttled: !created })
}
