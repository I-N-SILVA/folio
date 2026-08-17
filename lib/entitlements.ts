import 'server-only'
import { supabaseAdmin } from '@/lib/supabase'
import {
  DEFAULT_PLAN,
  dunningExpired,
  getEntitlements,
  getPlan,
  type Entitlements,
  type Plan,
} from '@/lib/plans'

export type ProfileRow = {
  id: string
  email: string | null
  plan: string
  status: string
  appsumo_license_key: string | null
  appsumo_tier: number | null
  /** When the current Stripe dunning run began; null when healthy. */
  stripe_past_due_since?: string | null
}

/**
 * Fetch a user's profile, lazily creating it if the row is missing (e.g. for
 * users created before the profiles table existed, or if the auth trigger has
 * not yet fired). Uses the service-role client so it works in any context.
 */
export async function getProfile(userId: string, email?: string | null): Promise<ProfileRow> {
  // `select('*')` rather than a column list: migration 011 adds dunning columns,
  // and a named select fails outright on an install that hasn't applied it yet.
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .maybeSingle()

  if (data) return data as ProfileRow

  const seed: ProfileRow = {
    id: userId,
    email: email ?? null,
    plan: DEFAULT_PLAN,
    status: 'active',
    appsumo_license_key: null,
    appsumo_tier: null,
  }
  await supabaseAdmin.from('profiles').upsert(seed, { onConflict: 'id' })
  return seed
}

/**
 * The plan to honour for a profile.
 *
 * Refunded and deactivated accounts fall back to Free, and so does a
 * subscription that has been `past_due` longer than the grace period. That last
 * case used to have no expiry: `past_due` counted as active, nothing recorded
 * when it started, and an account whose payments kept failing held Pro
 * indefinitely if the final cancellation event was missed or arrived out of
 * order. Deciding it here rather than in the webhook means the entitlement
 * lapses on time even if no further event ever arrives.
 *
 * Lifetime plans are untouched — they were never paid by subscription.
 */
export function effectivePlan(
  profile: Pick<ProfileRow, 'plan' | 'status'> & { stripe_past_due_since?: string | null }
): Plan {
  if (profile.status !== 'active') return getPlan(DEFAULT_PLAN)
  const plan = getPlan(profile.plan)
  if (plan.lifetime) return plan
  if (dunningExpired(profile.stripe_past_due_since)) return getPlan(DEFAULT_PLAN)
  return plan
}

export async function getUserPlan(userId: string, email?: string | null): Promise<Plan> {
  return effectivePlan(await getProfile(userId, email))
}

/**
 * The entitlements of a book's *owner*, for the public reader and embed.
 *
 * Deliberately read-only, unlike `getProfile`: this runs on a public page that
 * anyone can request, and auto-provisioning a profile row there would turn every
 * reader hit into a write. A missing row falls back to Free, which is the safe
 * direction — a paid account always has a row, because that is where the webhook
 * and the redeem flow put the plan.
 */
export async function getOwnerEntitlements(ownerId: string): Promise<Entitlements> {
  const { data } = await supabaseAdmin
    .from('profiles')
    .select('*')
    .eq('id', ownerId)
    .maybeSingle()

  if (!data) return getEntitlements(DEFAULT_PLAN)
  return effectivePlan(data as ProfileRow).entitlements
}

/**
 * What a reader is allowed to see of an edition, given who owns it.
 *
 * Both decisions have to be made from the plan rather than from the book row.
 * `settings.whitelabel` and `settings.gating.enabled` are author-controlled
 * booleans that the editor writes straight to the database, so treating either
 * as authoritative meant a free account could switch off the badge — removing
 * both the upgrade reason and the only growth loop the product has — and could
 * run a lead gate that only paid plans are sold.
 */
export function readerPolicy(
  settings: { whitelabel?: boolean; gating?: { enabled?: boolean } } | null | undefined,
  entitlements: Entitlements
): { showBadge: boolean; gateEnabled: boolean } {
  return {
    showBadge: !(entitlements.whiteLabel && settings?.whitelabel === true),
    gateEnabled: entitlements.leadGating && settings?.gating?.enabled === true,
  }
}

export async function getUserEntitlements(userId: string, email?: string | null): Promise<Entitlements> {
  return (await getUserPlan(userId, email)).entitlements
}

export async function countUserBooks(userId: string): Promise<number> {
  const { count } = await supabaseAdmin
    .from('books')
    .select('id', { count: 'exact', head: true })
    .eq('owner_id', userId)
  return count ?? 0
}

/**
 * Returns null if the user may create another book, otherwise a reason object
 * suitable for a 403 response.
 */
export async function checkBookQuota(
  userId: string,
  email?: string | null
): Promise<{ allowed: boolean; plan: Plan; used: number; limit: number }> {
  const plan = await getUserPlan(userId, email)
  const limit = plan.entitlements.maxBooks
  if (!Number.isFinite(limit)) return { allowed: true, plan, used: 0, limit }
  const used = await countUserBooks(userId)
  return { allowed: used < limit, plan, used, limit }
}

export { getEntitlements }
