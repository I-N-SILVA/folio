import 'server-only'
import crypto from 'node:crypto'
import { supabaseAdmin } from '@/lib/supabase'
import { planFromAppSumoTier, DEFAULT_PLAN } from '@/lib/plans'

// ─── AppSumo lifetime-deal integration ───────────────────────────────────────
//
// AppSumo notifies our webhook on purchase / tier change / refund and also lets
// buyers redeem a license key inside the app. This module is the single place
// that (a) verifies AppSumo webhook signatures, (b) upserts the license row, and
// (c) keeps the redeeming user's profile plan in sync with their license.
//
// The exact AppSumo payload/header names can shift between API versions — they
// are centralised here and documented in APPSUMO_LAUNCH.md so there is one place
// to reconcile against AppSumo's current developer docs.

export const APPSUMO_SIGNATURE_HEADER = 'x-appsumo-signature'

export type AppSumoAction = 'activate' | 'enhance' | 'reduce' | 'refund' | 'test'

export type AppSumoEvent = {
  action: AppSumoAction
  license_key?: string
  prev_license_key?: string | null
  tier?: number
  plan_id?: string
  uuid?: string
  activation_email?: string
  invoice_item_uuid?: string
  test?: boolean
}

export type LicenseStatus = 'active' | 'deactivated' | 'refunded'

/** Verify the HMAC-SHA256 signature AppSumo sends with each webhook. */
export function verifyAppSumoSignature(rawBody: string, signature: string | null): boolean {
  const key = process.env.APPSUMO_API_KEY
  // If no key is configured we cannot verify — fail closed in production.
  if (!key) return process.env.NODE_ENV !== 'production'
  if (!signature) return false

  const expected = crypto.createHmac('sha256', key).update(rawBody, 'utf8').digest('hex')
  const a = Buffer.from(expected)
  const b = Buffer.from(signature)
  if (a.length !== b.length) return false
  return crypto.timingSafeEqual(a, b)
}

/**
 * Apply an AppSumo webhook event to our database. Creates/updates the license
 * row and, if the license is already linked to a user, syncs their plan.
 */
export async function applyAppSumoEvent(event: AppSumoEvent): Promise<{ ok: boolean; message: string }> {
  const licenseKey = event.license_key?.trim()
  if (event.action === 'test') return { ok: true, message: 'test ok' }
  if (!licenseKey) return { ok: false, message: 'missing license_key' }

  const tier = event.tier ?? 1
  const plan = planFromAppSumoTier(tier)
  const isRefund = event.action === 'refund'
  const status: LicenseStatus = isRefund ? 'refunded' : 'active'

  // On tier change AppSumo issues a new license_key and references the old one.
  if (event.prev_license_key && event.prev_license_key !== licenseKey) {
    await supabaseAdmin
      .from('appsumo_licenses')
      .update({ status: 'deactivated', prev_license_key: event.prev_license_key })
      .eq('license_key', event.prev_license_key)
  }

  const { data: existing } = await supabaseAdmin
    .from('appsumo_licenses')
    .select('redeemed_by')
    .eq('license_key', licenseKey)
    .maybeSingle()

  // Carry the redemption link across a tier change.
  let redeemedBy: string | null = (existing?.redeemed_by as string | null) ?? null
  if (!redeemedBy && event.prev_license_key) {
    const { data: prev } = await supabaseAdmin
      .from('appsumo_licenses')
      .select('redeemed_by')
      .eq('license_key', event.prev_license_key)
      .maybeSingle()
    redeemedBy = (prev?.redeemed_by as string | null) ?? null
  }

  await supabaseAdmin.from('appsumo_licenses').upsert(
    {
      license_key: licenseKey,
      prev_license_key: event.prev_license_key ?? null,
      tier,
      plan,
      status,
      activation_email: event.activation_email ?? null,
      invoice_item_uuid: event.invoice_item_uuid ?? null,
      redeemed_by: redeemedBy,
    },
    { onConflict: 'license_key' }
  )

  if (redeemedBy) {
    await syncProfileFromLicense(redeemedBy, licenseKey)
  }

  return { ok: true, message: `${event.action} applied` }
}

/** Push a license's plan/status onto the linked user's profile. */
export async function syncProfileFromLicense(userId: string, licenseKey: string): Promise<void> {
  const { data: license } = await supabaseAdmin
    .from('appsumo_licenses')
    .select('plan, tier, status, license_key')
    .eq('license_key', licenseKey)
    .maybeSingle()

  if (!license) return

  const active = license.status === 'active'
  await supabaseAdmin
    .from('profiles')
    .update({
      plan: active ? license.plan : DEFAULT_PLAN,
      status: active ? 'active' : (license.status === 'refunded' ? 'refunded' : 'deactivated'),
      appsumo_license_key: license.license_key,
      appsumo_tier: license.tier,
    })
    .eq('id', userId)
}

export type RedeemResult =
  | { ok: true; plan: string }
  | { ok: false; reason: 'not_found' | 'refunded' | 'already_redeemed' }

/**
 * Link an AppSumo license key to a signed-in user and upgrade their plan.
 */
export async function redeemLicense(userId: string, rawKey: string): Promise<RedeemResult> {
  const licenseKey = rawKey.trim()

  // The claim below interpolates userId into a PostgREST filter expression.
  // It always arrives from supabase.auth.getUser(), so it is a server-derived
  // UUID rather than anything a caller supplies — but a filter string is the
  // wrong place to discover otherwise, so it is checked rather than trusted.
  if (!/^[0-9a-f-]{36}$/i.test(userId)) return { ok: false, reason: 'not_found' }

  const { data: license } = await supabaseAdmin
    .from('appsumo_licenses')
    .select('license_key, plan, status, redeemed_by')
    .eq('license_key', licenseKey)
    .maybeSingle()

  // Read first, purely so the caller gets a specific reason rather than a
  // generic failure. The read is NOT what decides the outcome — see below.
  if (!license) return { ok: false, reason: 'not_found' }
  if (license.status === 'refunded') return { ok: false, reason: 'refunded' }
  if (license.redeemed_by && license.redeemed_by !== userId) {
    return { ok: false, reason: 'already_redeemed' }
  }

  // The claim has to be the thing that decides it. Checking `redeemed_by` in a
  // separate SELECT and then updating unconditionally left a window where two
  // simultaneous redemptions of one license both passed the check and both
  // wrote — the second overwriting the first — so a single license granted a
  // paid plan to two accounts and the audit trail kept only the later one.
  // Trivially exploitable: fire the same code from two sessions at once.
  //
  // Narrowing the UPDATE to rows that are still unclaimed (or already this
  // user's, so a retry stays idempotent) makes the database arbitrate, and the
  // returned rows say whether we won. Same reasoning as the slug insert in
  // /api/books, which relies on the unique constraint rather than a prior read.
  const { data: claimed, error: claimError } = await supabaseAdmin
    .from('appsumo_licenses')
    .update({ redeemed_by: userId, redeemed_at: new Date().toISOString() })
    .eq('license_key', licenseKey)
    .neq('status', 'refunded')
    .or(`redeemed_by.is.null,redeemed_by.eq.${userId}`)
    .select('license_key, plan')

  if (claimError) return { ok: false, reason: 'not_found' }

  // No rows means another request claimed it between our read and our write,
  // or a refund landed in the same window.
  if (!claimed || claimed.length === 0) {
    return { ok: false, reason: 'already_redeemed' }
  }

  await syncProfileFromLicense(userId, licenseKey)
  return { ok: true, plan: claimed[0].plan ?? license.plan }
}
