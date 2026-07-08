import { NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { getStripe } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://qlico.app'

export async function POST() {
  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'Billing unavailable.' }, { status: 503 })

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle()

  const customerId = profile?.stripe_customer_id as string | undefined
  if (!customerId) {
    return NextResponse.json({ error: 'No billing account found.' }, { status: 400 })
  }

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${SITE_URL}/account`,
  })

  return NextResponse.json({ url: session.url })
}
