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

/**
 * Optional. Without it Pro is monthly only and nothing offers a yearly plan;
 * the webhook needs no change either way, because any active subscription
 * grants Pro whatever its interval.
 */
export const PRO_ANNUAL_PRICE_ID = process.env.NEXT_PUBLIC_STRIPE_PRICE_PRO_ANNUAL || ''

/**
 * Stripe Tax on checkout. Off unless `STRIPE_AUTOMATIC_TAX=true`.
 *
 * Selling a subscription to customers in the EU, the UK and many US states
 * means charging and remitting their sales tax or VAT. Stripe Tax calculates
 * it from the address checkout collects — but only after the account has tax
 * registrations set up in the Stripe dashboard, which is why this is a switch
 * rather than the default: turned on without them, it collects addresses and
 * charges no tax.
 */
export function isAutomaticTaxEnabled(): boolean {
  return process.env.STRIPE_AUTOMATIC_TAX === 'true'
}

export function isAnnualBillingEnabled(): boolean {
  return isBillingEnabled() && Boolean(PRO_ANNUAL_PRICE_ID)
}
