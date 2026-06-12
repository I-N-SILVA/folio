import 'server-only'
import Stripe from 'stripe'

let _stripe: Stripe | null = null

/** Lazy Stripe client. Returns null when billing is not configured. */
export function getStripe(): Stripe | null {
  const key = process.env.STRIPE_SECRET_KEY
  if (!key) return null
  if (!_stripe) _stripe = new Stripe(key)
  return _stripe
}

export function isBillingEnabled(): boolean {
  return Boolean(process.env.STRIPE_SECRET_KEY && process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO)
}

export const PRO_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO || ''
