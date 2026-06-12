import { NextRequest, NextResponse } from 'next/server'
import type Stripe from 'stripe'
import { supabaseAdmin } from '@/lib/supabase'
import { getStripe } from '@/lib/stripe'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Stripe subscription lifecycle → profile plan sync.
// Configure this URL in the Stripe dashboard and set STRIPE_WEBHOOK_SECRET.

const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due'])

async function setPlanForCustomer(
  customerId: string,
  opts: { active: boolean; subscriptionId?: string | null; status?: string | null }
) {
  const { data: profile } = await supabaseAdmin
    .from('profiles')
    .select('id, plan')
    .eq('stripe_customer_id', customerId)
    .maybeSingle()

  if (!profile) return

  // Never clobber an AppSumo lifetime plan with subscription changes.
  const isLifetime = typeof profile.plan === 'string' && profile.plan.startsWith('ltd_')

  const update: Record<string, unknown> = {
    stripe_subscription_id: opts.subscriptionId ?? null,
    stripe_status: opts.status ?? null,
  }

  if (opts.active) {
    if (!isLifetime) {
      update.plan = 'pro'
      update.status = 'active'
    }
  } else if (!isLifetime && profile.plan === 'pro') {
    // Subscription ended and Stripe was what granted Pro → revert to free.
    update.plan = 'free'
  }

  await supabaseAdmin.from('profiles').update(update).eq('id', profile.id)
}

export async function POST(request: NextRequest) {
  const stripe = getStripe()
  const secret = process.env.STRIPE_WEBHOOK_SECRET
  if (!stripe || !secret) {
    return NextResponse.json({ error: 'Billing unavailable.' }, { status: 503 })
  }

  const raw = await request.text()
  const signature = request.headers.get('stripe-signature')
  if (!signature) return NextResponse.json({ error: 'Missing signature' }, { status: 400 })

  let event: Stripe.Event
  try {
    event = stripe.webhooks.constructEvent(raw, signature, secret)
  } catch (err) {
    console.error('[stripe webhook] signature verification failed', err)
    return NextResponse.json({ error: 'Invalid signature' }, { status: 400 })
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated': {
        const sub = event.data.object as Stripe.Subscription
        await setPlanForCustomer(sub.customer as string, {
          active: ACTIVE_STATUSES.has(sub.status),
          subscriptionId: sub.id,
          status: sub.status,
        })
        break
      }
      case 'customer.subscription.deleted': {
        const sub = event.data.object as Stripe.Subscription
        await setPlanForCustomer(sub.customer as string, {
          active: false,
          subscriptionId: null,
          status: 'canceled',
        })
        break
      }
      default:
        break
    }
  } catch (err) {
    console.error('[stripe webhook] handler error', err)
    return NextResponse.json({ error: 'Handler error' }, { status: 500 })
  }

  return NextResponse.json({ received: true })
}
