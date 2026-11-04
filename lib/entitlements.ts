import 'server-only'
import { supabaseAdmin } from '@/lib/supabase'
import {
  DEFAULT_PLAN,
  aiUsageMonth,
  dunningExpired,
  formatStorage,
  getEntitlements,
  getPlan,
  storageAllows,
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
  const seed: ProfileRow = {
    id: userId,
    email: email ?? null,
    plan: DEFAULT_PLAN,
    status: 'active',
    appsumo_license_key: null,
    appsumo_tier: null,
  }

  try {
    const { data, error } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .maybeSingle()

    if (data) return data as ProfileRow

    if (!error) {
      await supabaseAdmin.from('profiles').upsert(seed, { onConflict: 'id' })
    }
    return seed
  } catch (err) {
    console.error('[entitlements] getProfile error fallback:', err)
    return seed
  }
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
  try {
    if (!profile || profile.status !== 'active') return getPlan(DEFAULT_PLAN)
    const plan = getPlan(profile.plan || DEFAULT_PLAN)
    if (plan.lifetime) return plan
    if (dunningExpired(profile.stripe_past_due_since)) return getPlan(DEFAULT_PLAN)
    return plan
  } catch {
    return getPlan(DEFAULT_PLAN)
  }
}

export async function getUserPlan(userId: string, email?: string | null): Promise<Plan> {
  try {
    const profile = await getProfile(userId, email)
    return effectivePlan(profile)
  } catch (err) {
    console.error('[entitlements] getUserPlan error fallback:', err)
    return getPlan(DEFAULT_PLAN)
  }
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
  try {
    const { data } = await supabaseAdmin
      .from('profiles')
      .select('*')
      .eq('id', ownerId)
      .maybeSingle()

    if (!data) return getEntitlements(DEFAULT_PLAN)
    return effectivePlan(data as ProfileRow).entitlements
  } catch {
    return getEntitlements(DEFAULT_PLAN)
  }
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

export async function getUserEntitlements(
  userId: string,
  email?: string | null
): Promise<Entitlements> {
  return (await getUserPlan(userId, email)).entitlements
}

export async function countUserBooks(userId: string): Promise<number> {
  try {
    const { count, error } = await supabaseAdmin
      .from('books')
      .select('id', { count: 'exact', head: true })
      .eq('owner_id', userId)
    if (error) {
      console.warn('[entitlements] countUserBooks query warning:', error.message)
      return 0
    }
    return count ?? 0
  } catch (err) {
    console.error('[entitlements] countUserBooks error fallback:', err)
    return 0
  }
}

/**
 * Returns null if the user may create another book, otherwise a reason object
 * suitable for a 403 response.
 */
export async function checkBookQuota(
  userId: string,
  email?: string | null
): Promise<{ allowed: boolean; plan: Plan; used: number; limit: number }> {
  try {
    const plan = await getUserPlan(userId, email)
    const limit = plan.entitlements.maxBooks
    if (!Number.isFinite(limit)) return { allowed: true, plan, used: 0, limit }
    const used = await countUserBooks(userId)
    return { allowed: used < limit, plan, used, limit }
  } catch (err) {
    console.error('[entitlements] checkBookQuota error fallback:', err)
    const plan = getPlan(DEFAULT_PLAN)
    return { allowed: true, plan, used: 0, limit: plan.entitlements.maxBooks }
  }
}

/**
 * Is this the database's edition-limit backstop talking?
 *
 * `enforce_book_limit` (006) raises `BOOK_LIMIT_REACHED` with a check_violation
 * SQLSTATE. Routes have to recognise it, because reaching it is not always a
 * bug: two creates racing each other both pass `checkBookQuota` and one loses
 * at the insert. Without this the loser gets HTTP 500 carrying a raw Postgres
 * exception string, which is what a free author actually saw for months while
 * the ladder in 006 and the one in `lib/plans.ts` disagreed about the free tier.
 */
export function isBookLimitError(error: { code?: string; message?: string } | null): boolean {
  if (!error) return false
  // Matched on the message, not on the SQLSTATE: the trigger raises
  // `check_violation` (23514), which `books` and `pages` also produce for real
  // CHECK constraints, and answering one of those with "upgrade your plan"
  // would be worse than the 500 this replaces.
  return /BOOK_LIMIT_REACHED/.test(error.message ?? '')
}

export { getEntitlements }

/**
 * Whether the user may store more, and how much they hold.
 *
 * Fails open: if `user_storage_bytes` (021) is missing or errors, uploads go
 * ahead. Refusing every upload on a deployment that has not applied 021 would
 * break the editor to protect a margin, which is the wrong way round; the
 * health check reports the missing function instead.
 */
export async function checkStorageQuota(
  userId: string,
  email?: string | null
): Promise<{ allowed: boolean; plan: Plan; usedBytes: number; limitMB: number }> {
  const plan = await getUserPlan(userId, email)
  const limitMB = plan.entitlements.storageMB
  try {
    const { data, error } = await supabaseAdmin.rpc('user_storage_bytes', { p_user_id: userId })
    if (error) {
      console.warn('[entitlements] user_storage_bytes unavailable:', error.message)
      return { allowed: true, plan, usedBytes: 0, limitMB }
    }
    const usedBytes = Number(data) || 0
    return { allowed: storageAllows(usedBytes, plan.entitlements), plan, usedBytes, limitMB }
  } catch (err) {
    console.error('[entitlements] checkStorageQuota error fallback:', err)
    return { allowed: true, plan, usedBytes: 0, limitMB }
  }
}

/** The 403 body for an account over its storage allowance. */
export function storageLimitResponse(quota: { plan: Plan; usedBytes: number; limitMB: number }) {
  return {
    error: `You've used your plan's ${formatStorage(quota.limitMB)} of storage. Delete an edition or upgrade to upload more.`,
    code: 'storage_limit',
    plan: quota.plan.id,
    usedBytes: quota.usedBytes,
    limitMB: quota.limitMB,
  }
}

/**
 * Claims up to `pages` pages of this month's AI allowance; returns how many
 * were granted.
 *
 * Fails closed, unlike storage: a missing `claim_ai_pages` grants nothing and
 * the caller falls back to the heuristic. Detection still answers, just without
 * Gemini — so the cost of a deployment missing 021 is worse pins, not an
 * unmetered bill.
 */
export async function claimAiPages(userId: string, pages: number, limit: number): Promise<number> {
  if (pages <= 0 || limit <= 0) return 0
  try {
    const { data, error } = await supabaseAdmin.rpc('claim_ai_pages', {
      p_user_id: userId,
      p_month: aiUsageMonth(),
      p_pages: pages,
      p_limit: Number.isFinite(limit) ? limit : 2_147_483_647,
    })
    if (error) {
      console.warn('[entitlements] claim_ai_pages unavailable:', error.message)
      return 0
    }
    return Math.max(0, Math.min(pages, Number(data) || 0))
  } catch (err) {
    console.error('[entitlements] claimAiPages error fallback:', err)
    return 0
  }
}

/** Pages of AI detection used this month. 0 when unknown. */
export async function aiPagesUsed(userId: string): Promise<number> {
  try {
    const { data } = await supabaseAdmin
      .from('ai_usage')
      .select('pages')
      .eq('user_id', userId)
      .eq('month', aiUsageMonth())
      .maybeSingle()
    return Number(data?.pages) || 0
  } catch {
    return 0
  }
}
