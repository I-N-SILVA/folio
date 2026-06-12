import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { checkBookQuota } from '@/lib/entitlements'

export const dynamic = 'force-dynamic'

// Lightweight endpoint the studio UI calls to render quota / upgrade state.
export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed, plan, used, limit } = await checkBookQuota(user.id, user.email)

  return NextResponse.json({
    plan: plan.id,
    planName: plan.name,
    lifetime: plan.lifetime,
    entitlements: plan.entitlements,
    books: {
      used,
      limit: Number.isFinite(limit) ? limit : null,
      allowed,
    },
  })
}
