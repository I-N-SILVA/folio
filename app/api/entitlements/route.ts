import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { isAiEnabled } from '@/lib/ai'
import { checkBookQuota } from '@/lib/entitlements'

export const dynamic = 'force-dynamic'

// Lightweight endpoint the studio UI calls to render quota / upgrade state.
export async function GET() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { allowed, plan, used, limit } = await checkBookQuota(user.id, user.email)

  // The studio offers "Magic AI Enhancement" checked by default. Without a key
  // configured that promises hotspot detection and SEO tags the install cannot
  // produce, so the UI needs to know.
  return NextResponse.json({
    ai: { enabled: isAiEnabled() },
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
