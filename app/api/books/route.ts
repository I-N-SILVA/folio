import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase-server'
import { checkBookQuota } from '@/lib/entitlements'
import { formatQuota } from '@/lib/plans'

const CreateBookSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  theme: z.object({
    preset: z.enum(['ivory', 'slate', 'cream', 'carbon', 'sage', 'custom']).default('ivory'),
  }).optional(),
})

export async function GET(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('books')
    .select('*, pages(count)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json(data)
}

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = CreateBookSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Enforce the plan's book quota before doing any work.
  const quota = await checkBookQuota(user.id, user.email)
  if (!quota.allowed) {
    return NextResponse.json(
      {
        error: `You've reached your plan's limit of ${formatQuota(quota.limit)} book${
          quota.limit === 1 ? '' : 's'
        }. Upgrade to publish more.`,
        code: 'plan_limit',
        plan: quota.plan.id,
        used: quota.used,
        limit: Number.isFinite(quota.limit) ? quota.limit : null,
      },
      { status: 403 }
    )
  }

  // Insert under the user's own RLS context (owner_all policy permits it). Slug
  // uniqueness is enforced authoritatively by the DB constraint, which also
  // closes the check-then-insert race a separate SELECT would leave open.
  const { data, error } = await supabase
    .from('books')
    .insert({
      title: parsed.data.title,
      description: parsed.data.description ?? null,
      slug: parsed.data.slug,
      owner_id: user.id,
      theme: parsed.data.theme ?? { preset: 'ivory' },
      settings: { published: false, unlisted: false },
    })
    .select()
    .single()

  if (error) {
    // 23505 = unique_violation on the slug.
    if (error.code === '23505') {
      return NextResponse.json({ error: 'Slug already taken' }, { status: 409 })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json(data, { status: 201 })
}
