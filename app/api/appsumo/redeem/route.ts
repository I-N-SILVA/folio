import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerSupabase } from '@/lib/supabase-server'
import { redeemLicense } from '@/lib/appsumo'
import { getPlan } from '@/lib/plans'

const RedeemSchema = z.object({
  code: z.string().min(3).max(200),
})

export async function POST(request: NextRequest) {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const parsed = RedeemSchema.safeParse(await request.json())
  if (!parsed.success) {
    return NextResponse.json({ error: 'Enter a valid license code.' }, { status: 400 })
  }

  const result = await redeemLicense(user.id, parsed.data.code)

  if (!result.ok) {
    const messages: Record<string, string> = {
      not_found: 'We could not find that license code. Double-check it and try again.',
      refunded: 'This license has been refunded and can no longer be redeemed.',
      already_redeemed: 'This license has already been redeemed by another account.',
    }
    return NextResponse.json({ error: messages[result.reason] }, { status: 400 })
  }

  return NextResponse.json({ ok: true, plan: result.plan, planName: getPlan(result.plan).name })
}
