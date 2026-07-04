// ─── Qlico plan catalog & entitlements ──────────────────────────────────────
//
// Single source of truth for what each plan can do. Used by:
//   - the books API to enforce limits
//   - the account / pricing UI to show entitlements
//   - the AppSumo webhook + redeem flow to map a purchased tier → a plan
//
// `Infinity` means unlimited. Keep this file free of server-only imports so it
// can be used from both client and server components.

export type PlanId = 'free' | 'pro' | 'ltd_tier1' | 'ltd_tier2' | 'ltd_tier3'

export type Entitlements = {
  /** Maximum number of books a user may own. */
  maxBooks: number
  /** How many days of analytics history are retained / shown. */
  analyticsDays: number
  /** Whether the public reader shows the "Made with Qlico" watermark. */
  watermark: boolean
  /** Custom domain publishing. */
  customDomain: boolean
  /** PDF → flipbook import. */
  pdfImport: boolean
  /** Lead-gating / email capture on the reader. */
  leadGating: boolean
  /** CSV export of analytics. */
  csvExport: boolean
  /** Remove Qlico branding entirely (white-label). */
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
  free: {
    id: 'free',
    name: 'Free',
    tagline: 'Publish your first interactive book.',
    lifetime: false,
    entitlements: {
      maxBooks: 1,
      analyticsDays: 7,
      watermark: true,
      customDomain: false,
      pdfImport: false,
      leadGating: false,
      csvExport: false,
      whiteLabel: false,
    },
  },
  pro: {
    id: 'pro',
    name: 'Pro',
    tagline: 'For creators and teams who publish often.',
    lifetime: false,
    entitlements: {
      maxBooks: Infinity,
      analyticsDays: 90,
      watermark: false,
      customDomain: true,
      pdfImport: true,
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
      watermark: false,
      customDomain: false,
      pdfImport: true,
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
      watermark: false,
      customDomain: true,
      pdfImport: true,
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
      watermark: false,
      customDomain: true,
      pdfImport: true,
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

/** Human-readable book quota, e.g. "10" or "Unlimited". */
export function formatQuota(n: number): string {
  return Number.isFinite(n) ? String(n) : 'Unlimited'
}
