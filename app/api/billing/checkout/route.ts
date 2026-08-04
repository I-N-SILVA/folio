import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabase } from '@/lib/supabase-server'
import { supabaseAdmin } from '@/lib/supabase'
import { getStripe, isBillingEnabled, PRO_PRICE_ID } from '@/lib/stripe'

export const dynamic = 'force-dynamic'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://qlico.app'

export async function POST(request: NextRequest) {
  if (!isBillingEnabled()) {
    return NextResponse.json({ error: 'Billing is not configured.' }, { status: 503 })
  }
  const stripe = getStripe()
  if (!stripe) return NextResponse.json({ error: 'Billing unavailable.' }, { status: 503 })

  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Reuse an existing Stripe customer if we have one.
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('stripe_customer_id')
    .eq('id', user.id)
    .maybeSingle()

  let customerId = profile?.stripe_customer_id as string | undefined
  if (!customerId) {
    const customer = await stripe.customers.create({
      email: user.email ?? undefined,
      metadata: { supabase_user_id: user.id },
    })

    // Read-then-write: two checkout clicks in quick succession both saw an
    // empty column and both created a customer, with the second overwriting
    // the first. The subscription that then completed against the losing
    // customer belonged to an id no longer stored anywhere, so the webhook
    // couldn't find the account and the payment granted nothing.
    //
    // Claiming only while the column is still empty makes the database pick a
    // winner. A loser reuses whichever id was stored rather than pushing its
    // own, so exactly one customer id is ever in play per account.
    const { data: claimed } = await supabaseAdmin
      .from('profiles')
      .update({ stripe_customer_id: customer.id })
      .eq('id', user.id)
      .is('stripe_customer_id', null)
      .select('stripe_customer_id')

    if (claimed && claimed.length > 0) {
      customerId = customer.id
    } else {
      const { data: winner } = await supabaseAdmin
        .from('profiles')
        .select('stripe_customer_id')
        .eq('id', user.id)
        .maybeSingle()
      customerId = (winner?.stripe_customer_id as string | undefined) ?? customer.id
    }
  }

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: PRO_PRICE_ID, quantity: 1 }],
    allow_promotion_codes: true,
    success_url: `${SITE_URL}/account?upgraded=1`,
    cancel_url: `${SITE_URL}/#pricing`,
    metadata: { supabase_user_id: user.id },
    subscription_data: { metadata: { supabase_user_id: user.id } },
  })

  return NextResponse.json({ url: session.url })
}
