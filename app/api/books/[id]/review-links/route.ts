import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { newReviewToken, reviewPath, REVIEW_LINK_DAYS } from '@/lib/review'

export const dynamic = 'force-dynamic'

async function owns(id: string) {
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

const missing = (e: { code?: string } | null) =>
  e?.code === '42P01' || e?.code === 'PGRST202' || e?.code === '42883'

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owned = await owns(id)
  if ('error' in owned) return owned.error

  const { data, error } = await supabaseAdmin
    .from('book_review_links')
    .select('id, token, label, created_at, expires_at, revoked_at')
    .eq('book_id', id)
    .order('created_at', { ascending: false })

  if (error) {
    if (missing(error)) return NextResponse.json({ links: [], unavailable: true })
    console.error('[review-links] list failed:', error)
    return NextResponse.json({ error: 'Could not read the review links.' }, { status: 500 })
  }

  return NextResponse.json({
    links: (data ?? []).map((l) => ({
      id: l.id,
      label: l.label,
      created_at: l.created_at,
      expires_at: l.expires_at,
      revoked_at: l.revoked_at,
      // The token only ever leaves here as a path the author can copy. It is
      // still the credential, so it is not logged and not echoed anywhere else.
      path: reviewPath(l.token as string),
    })),
  })
}

const CreateSchema = z.object({
  label: z.string().trim().min(1).max(60).optional(),
  /** Null is a deliberate "no expiry", absent means the default window. */
  days: z.number().int().min(1).max(365).nullable().optional(),
})

export async function POST(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const owned = await owns(id)
  if ('error' in owned) return owned.error

  const parsed = CreateSchema.safeParse(await request.json().catch(() => ({})))
  if (!parsed.success) return NextResponse.json({ error: 'Invalid body' }, { status: 400 })

  const days = parsed.data.days === undefined ? REVIEW_LINK_DAYS : parsed.data.days
  const token = newReviewToken()

  const { data, error } = await supabaseAdmin
    .from('book_review_links')
    .insert({
      book_id: id,
      token,
      label: parsed.data.label ?? null,
      expires_at: days === null ? null : new Date(Date.now() + days * 86_400_000).toISOString(),
    })
    .select('id, label, created_at, expires_at')
    .single()

  if (error) {
    if (missing(error)) {
      return NextResponse.json(
        { error: 'Review links are not available on this deployment yet.' },
        { status: 503 }
      )
    }
    console.error('[review-links] create failed:', error)
    return NextResponse.json({ error: 'Could not create a review link.' }, { status: 500 })
  }

  return NextResponse.json({ ...data, path: reviewPath(token) }, { status: 201 })
}
