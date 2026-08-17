// ─── Qlico plan catalog & entitlements ──────────────────────────────────────
//
// Single source of truth for what each plan can do. Used by:
//   - the books API to enforce limits
//   - the reader and embed routes to decide the badge and the lead gate
//   - the analytics API to clamp the visible window and gate CSV export
//   - the account / pricing UI to show entitlements
//   - the AppSumo webhook + redeem flow to map a purchased tier → a plan
//
// `Infinity` means unlimited. Keep this file free of server-only imports so it
// can be used from both client and server components.
//
// Every key here is enforced somewhere on the server. That rule is the point of
// the file: this used to declare eight entitlements of which exactly one
// (`maxBooks`) was checked anywhere, so the pricing page sold four features the
// product handed out for free, and `customDomain` was sold in three places
// without existing at all. An entitlement nothing enforces is worse than no
// entitlement — it reads as a promise. If you add a key, add its check in the
// same change, and see `lib/entitlements.ts` for where the checks live.

export type PlanId = 'free' | 'pro' | 'ltd_tier1' | 'ltd_tier2' | 'ltd_tier3'

export type Entitlements = {
  /** Maximum number of editions a user may own. Enforced: POST /api/books, POST /api/import/pdf, DB trigger. */
  maxBooks: number
  /** How many days of reader analytics are queryable. Enforced: GET /api/analytics/[slug]. */
  analyticsDays: number
  /** Lead gating / email capture on the reader. Enforced: the reader + embed routes, POST /api/books/unlock. */
  leadGating: boolean
  /** CSV export of events and captured leads. Enforced: GET /api/analytics/[slug]/export. */
  csvExport: boolean
  /** May remove the "Powered by QLICO" badge from the reader. Enforced: the reader + embed routes. */
  whiteLabel: boolean
}

export type Plan = {
  id: PlanId
  name: string
  /** Short marketing line. */
  tagline: string
  /** Is this a one-time lifetime deal (AppSumo) rather than a subscription? */
  lifetime: boolean
  entitlements: Entitlements
}

export const PLANS: Record<PlanId, Plan> = {
  // The free tier deliberately includes PDF import and three editions. Import
  // is the promise on the landing page — paywalling it meant a new user could
  // not do the one thing they arrived to do — and a one-edition cap meant a
  // single abandoned import (which strands a book holding a slug and a quota
  // slot) bricked the account. Free gives away enough to publish something real
  // and watch it being read; the paid plans sell what happens next.
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Publish something real and see who reads it.',
    lifetime: false,
    entitlements: {
      maxBooks: 3,
      analyticsDays: 30,
      leadGating: false,
      csvExport: false,
      whiteLabel: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For anyone whose editions have to bring something back.',
    lifetime: false,
    entitlements: {
      maxBooks: Infinity,
      analyticsDays: 365,
      leadGating: true,
      csvExport: true,
      whiteLabel: true,
    },
  },
  // ── AppSumo lifetime deal tiers ──────────────────────────────────────────
  ltd_tier1: {
    id: 'ltd_tier1',
    name: 'Qlico LTD — Tier 1',
    tagline: 'Lifetime access for solo creators.',
    lifetime: true,
    entitlements: {
      maxBooks: 10,
      analyticsDays: 90,
      leadGating: true,
      csvExport: true,
      whiteLabel: false,
    },
  },
  ltd_tier2: {
    id: 'ltd_tier2',
    name: 'Qlico LTD — Tier 2',
    tagline: 'Lifetime access for growing studios.',
    lifetime: true,
    entitlements: {
      maxBooks: 50,
      analyticsDays: 180,
      leadGating: true,
      csvExport: true,
      whiteLabel: true,
    },
  },
  ltd_tier3: {
    id: 'ltd_tier3',
    name: 'Qlico LTD — Tier 3',
    tagline: 'Unlimited lifetime access for agencies.',
    lifetime: true,
    entitlements: {
      maxBooks: Infinity,
      analyticsDays: 365,
      leadGating: true,
      csvExport: true,
      whiteLabel: true,
    },
  },
}

export const DEFAULT_PLAN: PlanId = 'free'

/** Maps an AppSumo purchase tier (1-based) to a Qlico plan id. */
export const APPSUMO_TIER_TO_PLAN: Record<number, PlanId> = {
  1: 'ltd_tier1',
  2: 'ltd_tier2',
  3: 'ltd_tier3',
}

export function planFromAppSumoTier(tier: number | null | undefined): PlanId {
  if (!tier) return 'ltd_tier1'
  return APPSUMO_TIER_TO_PLAN[tier] ?? 'ltd_tier3'
}

export function isValidPlan(id: string | null | undefined): id is PlanId {
  return !!id && id in PLANS
}

export function getPlan(id: string | null | undefined): Plan {
  return isValidPlan(id) ? PLANS[id] : PLANS[DEFAULT_PLAN]
}

export function getEntitlements(id: string | null | undefined): Entitlements {
  return getPlan(id).entitlements
}

/**
 * How long a subscription may stay `past_due` before entitlements revert.
 *
 * A failed payment shouldn't take the product away the same afternoon — cards
 * expire, banks decline for a day — but the grace has to end somewhere, and
 * `past_due` was previously treated as active with no expiry at all. Two weeks
 * covers Stripe's retry schedule with room to spare.
 */
export const DUNNING_GRACE_DAYS = 14

/** Whether a dunning run has outlived its grace period. */
export function dunningExpired(pastDueSince: string | null | undefined, now = Date.now()): boolean {
  if (!pastDueSince) return false
  const since = Date.parse(pastDueSince)
  if (Number.isNaN(since)) return false
  return now - since > DUNNING_GRACE_DAYS * 24 * 60 * 60 * 1000
}

/** Human-readable edition quota, e.g. "10" or "Unlimited". */
export function formatQuota(n: number): string {
  return Number.isFinite(n) ? String(n) : 'Unlimited'
}

/**
 * Clamps a requested analytics window to what the plan allows.
 *
 * Returns the number of days to query, never null: "all time" is not a window
 * any plan grants, it's the absence of one, and the range picker used to send
 * `all` straight through to the query.
 */
export function clampAnalyticsDays(requested: number | null, entitlements: Entitlements): number {
  const limit = entitlements.analyticsDays
  if (requested === null || !Number.isFinite(requested) || requested <= 0) return limit
  return Math.min(requested, limit)
}
