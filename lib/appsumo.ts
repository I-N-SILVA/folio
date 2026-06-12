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

  const { data: license } = await supabaseAdmin
    .from('appsumo_licenses')
    .select('license_key, plan, status, redeemed_by')
    .eq('license_key', licenseKey)
    .maybeSingle()

  if (!license) return { ok: false, reason: 'not_found' }
  if (license.status === 'refunded') return { ok: false, reason: 'refunded' }
  if (license.redeemed_by && license.redeemed_by !== userId) {
    return { ok: false, reason: 'already_redeemed' }
  }

  await supabaseAdmin
    .from('appsumo_licenses')
    .update({ redeemed_by: userId, redeemed_at: new Date().toISOString() })
    .eq('license_key', licenseKey)

  await syncProfileFromLicense(userId, licenseKey)
  return { ok: true, plan: license.plan }
}
