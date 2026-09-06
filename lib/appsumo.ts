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

/**
 * What this module does about an event, regardless of what AppSumo called it.
 *
 * These are the v1 names because they are what the rest of this file was
 * written against. They are an internal vocabulary now — see `normalizeAction`.
 */
export type AppSumoAction = 'activate' | 'enhance' | 'reduce' | 'refund' | 'test'

/**
 * Both payload shapes AppSumo has shipped.
 *
 * The Licensing API v1 sends `action` with `activate` / `enhance` / `reduce` /
 * `refund`. The current v2 sends **`event`** with `purchase` / `activate` /
 * `upgrade` / `downgrade` / `deactivate` / `migrate`, alongside
 * `license_status`, `event_timestamp` and a `test` boolean.
 *
 * This file was written for v1 only, and read `event.action`. Against a v2 deal
 * that is `undefined`, the route answers `400 missing action`, and **every
 * webhook AppSumo sends is rejected** — no licence row is ever created, and
 * every buyer's code does not exist. Which of the two a deal is on is decided
 * in the partner dashboard, not here, so this accepts both.
 *
 * Sourced from AppSumo's published documentation via search
 * (docs.licensing.appsumo.com is not reachable from this network). Treat it as
 * a strong default, not as a substitute for the reconciliation step in
 * APPSUMO_LAUNCH.md — send a real test event and confirm a row lands.
 */
export type AppSumoEvent = {
  /** v1. */
  action?: string
  /** v2. */
  event?: string
  license_key?: string
  prev_license_key?: string | null
  /** v2, on add-on webhooks: the deal this add-on hangs off. */
  parent_license_key?: string | null
  tier?: number
  plan_id?: string
  uuid?: string
  activation_email?: string
  invoice_item_uuid?: string
  /** v2 sends the licence's own status alongside the event. */
  license_status?: string
  event_timestamp?: number | string
  created_at?: number | string
  test?: boolean
  extra?: Record<string, unknown>
}

/**
 * v2's verbs mapped onto the internal ones. `purchase` and `activate` both mean
 * "there is a licence now" — v2 splits buying from the buyer first using it,
 * and both should leave an active row, which is what `activate` does here.
 */
const EVENT_ALIASES: Record<string, AppSumoAction> = {
  // v1, unchanged.
  activate: 'activate',
  enhance: 'enhance',
  reduce: 'reduce',
  refund: 'refund',
  test: 'test',
  // v2.
  purchase: 'activate',
  upgrade: 'enhance',
  downgrade: 'reduce',
  deactivate: 'refund',
}

/**
 * The action to take, from either payload shape.
 *
 * Returns null for a verb neither version defines — `migrate`, for one, which
 * v2 sends for deal add-ons and which this product does not sell. Doing nothing
 * and saying so beats guessing at a licence change.
 */
export function normalizeAction(event: AppSumoEvent): AppSumoAction | null {
  const raw = (event.event ?? event.action ?? '').toString().trim().toLowerCase()
  if (!raw) return null
  return EVENT_ALIASES[raw] ?? null
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
  const action = normalizeAction(event)
  if (!action) {
    // A verb neither API version defines — `migrate` for a deal add-on, or
    // something added since. 200 with a message rather than an error: AppSumo
    // retries a non-2xx, and retrying something we will never understand just
    // fills their queue.
    return { ok: true, message: `ignored: ${event.event ?? event.action ?? 'no event'}` }
  }

  const licenseKey = event.license_key?.trim()
  if (action === 'test') return { ok: true, message: 'test ok' }
  if (!licenseKey) return { ok: false, message: 'missing license_key' }

  const tier = event.tier ?? 1
  const plan = planFromAppSumoTier(tier)
  const isRefund = action === 'refund'
  const status: LicenseStatus = isRefund ? 'refunded' : 'active'

  // On tier change AppSumo issues a new license_key and references the old one.
  if (event.prev_license_key && event.prev_license_key !== licenseKey) {
    await supabaseAdmin
      .from('appsumo_licenses')
      .update({ status: 'deactivated', prev_license_key: event.prev_license_key })
      .eq('license_key', event.prev_license_key)
  }

  // `redeemed_by` is deliberately absent from this upsert. It used to be read
  // above and written back here, so a redemption landing between the read and
  // the write was overwritten with null — silently un-linking a license its
  // buyer had already claimed. That is worse now that redeeming is gated on
  // `redeemed_by IS NULL`: the un-linked license becomes claimable by anyone.
  //
  // ON CONFLICT DO UPDATE only assigns the columns listed, so leaving it out
  // preserves whatever the row already holds, and a genuinely new row gets the
  // column default of null, which is correct for an unredeemed license.
  const { error: upsertError } = await supabaseAdmin.from('appsumo_licenses').upsert(
    {
      license_key: licenseKey,
      prev_license_key: event.prev_license_key ?? null,
      tier,
      plan,
      status,
      activation_email: event.activation_email ?? null,
      invoice_item_uuid: event.invoice_item_uuid ?? null,
    },
    { onConflict: 'license_key' }
  )

  // The write's error was discarded, so a failed upsert still answered 200 and
  // AppSumo — which retries on a non-2xx — never sent the event again. The
  // licence was simply gone, and the buyer's code did not exist. Found by
  // running the webhook over HTTP against a real database and watching it
  // report success with no row written.
  if (upsertError) {
    console.error('[appsumo] could not write the license', upsertError.message)
    return { ok: false, message: `could not persist license: ${upsertError.message}` }
  }

  // A tier change issues a new key, so the redemption link has to move across.
  // Conditional on the new row still being unclaimed, so this can never
  // overwrite a redemption that happened in the meantime.
  if (event.prev_license_key && event.prev_license_key !== licenseKey) {
    const { data: prev } = await supabaseAdmin
      .from('appsumo_licenses')
      .select('redeemed_by, redeemed_at')
      .eq('license_key', event.prev_license_key)
      .maybeSingle()

    const carriedOver = (prev?.redeemed_by as string | null) ?? null
    if (carriedOver) {
      await supabaseAdmin
        .from('appsumo_licenses')
        .update({ redeemed_by: carriedOver, redeemed_at: prev?.redeemed_at ?? new Date().toISOString() })
        .eq('license_key', licenseKey)
        .is('redeemed_by', null)
    }
  }

  // Read the holder back rather than trusting the value we started from: the
  // upsert and the carry-over above are the authority on who owns it now.
  const { data: current } = await supabaseAdmin
    .from('appsumo_licenses')
    .select('redeemed_by')
    .eq('license_key', licenseKey)
    .maybeSingle()

  const holder = (current?.redeemed_by as string | null) ?? null
  if (holder) {
    await syncProfileFromLicense(holder, licenseKey)
  }

  return { ok: true, message: `${action} applied` }
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
  // It runs as one statement in the database (migration 015) rather than as a
  // PostgREST filter. It was written as a filter first, with
  // `.or('redeemed_by.is.null,redeemed_by.eq.' + userId)`, and that never
  // worked: PostgREST compiles an UPDATE carrying a `select=` into a CTE and
  // then applies logical filters a second time to the CTE's output, where the
  // column it names does not exist. Postgres answers `42703` and this function
  // reported `not_found` — so every redemption failed, for everyone, with the
  // buyer holding a valid code. Nothing caught it because the unit tests assert
  // against a mock of the client. See the migration for the generated SQL.
  const { data: claimed, error: claimError } = await supabaseAdmin.rpc('claim_appsumo_license', {
    p_license_key: licenseKey,
    p_user_id: userId,
  })

  if (claimError) {
    // Worth a line in the log: the only ways here are the function being absent
    // (an unapplied migration) or the database being unreachable, and both look
    // to the buyer like a code that does not exist.
    console.error('[appsumo] claim failed', claimError.message)
    return { ok: false, reason: 'not_found' }
  }

  const rows = (claimed ?? []) as { license_key: string; plan: string }[]

  // No rows means another request claimed it between our read and our write, or
  // a refund landed in the same window.
  if (rows.length === 0) {
    return { ok: false, reason: 'already_redeemed' }
  }

  await syncProfileFromLicense(userId, licenseKey)
  return { ok: true, plan: rows[0].plan ?? license.plan }
}
