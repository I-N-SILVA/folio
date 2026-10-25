import { describe, it, expect } from 'vitest'
import {
  getPlan,
  getEntitlements,
  isValidPlan,
  planFromAppSumoTier,
  formatQuota,
  formatStorage,
  storageAllows,
  aiUsageMonth,
  DEFAULT_PLAN,
  PLANS,
} from './plans'

describe('isValidPlan', () => {
  it('accepts known plan ids', () => {
    expect(isValidPlan('free')).toBe(true)
    expect(isValidPlan('pro')).toBe(true)
    expect(isValidPlan('ltd_tier3')).toBe(true)
  })

  it('rejects unknown / empty values', () => {
    expect(isValidPlan('enterprise')).toBe(false)
    expect(isValidPlan(null)).toBe(false)
    expect(isValidPlan(undefined)).toBe(false)
    expect(isValidPlan('')).toBe(false)
  })
})

describe('getPlan', () => {
  it('returns the matching plan', () => {
    expect(getPlan('pro').id).toBe('pro')
  })

  it('falls back to the default plan for unknown ids', () => {
    expect(getPlan('nonsense').id).toBe(DEFAULT_PLAN)
    expect(getPlan(null).id).toBe(DEFAULT_PLAN)
  })
})

describe('getEntitlements', () => {
  it('mirrors the plan entitlements', () => {
    expect(getEntitlements('free')).toEqual(PLANS.free.entitlements)
    expect(getEntitlements('pro').maxBooks).toBe(PLANS.pro.entitlements.maxBooks)
  })
})

describe('planFromAppSumoTier', () => {
  it('maps each known tier', () => {
    expect(planFromAppSumoTier(1)).toBe('ltd_tier1')
    expect(planFromAppSumoTier(2)).toBe('ltd_tier2')
    expect(planFromAppSumoTier(3)).toBe('ltd_tier3')
  })

  it('defaults a missing tier to tier 1', () => {
    expect(planFromAppSumoTier(null)).toBe('ltd_tier1')
    expect(planFromAppSumoTier(undefined)).toBe('ltd_tier1')
    expect(planFromAppSumoTier(0)).toBe('ltd_tier1')
  })

  it('clamps a tier above the range to the top tier', () => {
    // If AppSumo adds a tier above ours, that buyer paid the most and should
    // get the best plan we have.
    expect(planFromAppSumoTier(99)).toBe('ltd_tier3')
  })

  it('does not hand the top tier to a value it does not understand', () => {
    // The fallback used to be `?? 'ltd_tier3'` for anything outside the map, so
    // a negative, fractional or non-numeric tier granted unlimited lifetime
    // access. `tier` comes straight off the webhook payload.
    expect(planFromAppSumoTier(-1)).toBe('ltd_tier1')
    expect(planFromAppSumoTier(0.5)).toBe('ltd_tier1')
    expect(planFromAppSumoTier(NaN)).toBe('ltd_tier1')
    expect(planFromAppSumoTier(Infinity as unknown as number)).toBe('ltd_tier1')
    expect(planFromAppSumoTier('3' as unknown as number)).toBe('ltd_tier1')
  })

  it('floors a fractional tier inside the range rather than falling through', () => {
    expect(planFromAppSumoTier(2.7)).toBe('ltd_tier2')
  })
})

describe('formatQuota', () => {
  it('renders finite numbers', () => {
    expect(formatQuota(10)).toBe('10')
  })

  it('renders Infinity as "Unlimited"', () => {
    expect(formatQuota(Infinity)).toBe('Unlimited')
  })
})

describe('usage allowances', () => {
  it('gives no plan unlimited editions', () => {
    // An unlimited lifetime plan is an open-ended cost sold for one payment.
    for (const plan of Object.values(PLANS)) {
      expect(Number.isFinite(plan.entitlements.maxBooks), plan.id).toBe(true)
    }
  })

  it('gives no plan unlimited storage, lifetime tiers included', () => {
    // Storage is the cost that grows for as long as an account exists, and a
    // lifetime plan pays for it once.
    for (const plan of Object.values(PLANS)) {
      expect(Number.isFinite(plan.entitlements.storageMB), plan.id).toBe(true)
      expect(plan.entitlements.storageMB, plan.id).toBeGreaterThan(0)
    }
  })

  it('bounds AI detection on every plan, and leaves Free enough to try it', () => {
    for (const plan of Object.values(PLANS)) {
      expect(Number.isFinite(plan.entitlements.aiPagesPerMonth), plan.id).toBe(true)
    }
    expect(PLANS.free.entitlements.aiPagesPerMonth).toBeGreaterThan(0)
  })

  it('never gives a higher lifetime tier less than a lower one', () => {
    const tiers = [PLANS.ltd_tier1, PLANS.ltd_tier2, PLANS.ltd_tier3].map((p) => p.entitlements)
    for (let i = 1; i < tiers.length; i++) {
      expect(tiers[i].storageMB).toBeGreaterThanOrEqual(tiers[i - 1].storageMB)
      expect(tiers[i].aiPagesPerMonth).toBeGreaterThanOrEqual(tiers[i - 1].aiPagesPerMonth)
    }
  })
})

describe('formatStorage', () => {
  it('writes MB below a gigabyte and GB from one', () => {
    expect(formatStorage(500)).toBe('500 MB')
    expect(formatStorage(0)).toBe('0 MB')
    expect(formatStorage(10_000)).toBe('10 GB')
    expect(formatStorage(1_500)).toBe('1.5 GB')
  })
})

describe('storageAllows', () => {
  const free = PLANS.free.entitlements

  it('allows an upload under the allowance and refuses one at it', () => {
    expect(storageAllows(0, free)).toBe(true)
    expect(storageAllows(free.storageMB * 1_000_000 - 1, free)).toBe(true)
    expect(storageAllows(free.storageMB * 1_000_000, free)).toBe(false)
  })
})

describe('aiUsageMonth', () => {
  it('keys usage by the first of the month, in UTC', () => {
    expect(aiUsageMonth(new Date('2026-10-25T12:00:00Z'))).toBe('2026-10-01')
    // Late on the 31st in a western timezone is already November in UTC, and
    // the allowance follows UTC so every server agrees.
    expect(aiUsageMonth(new Date('2026-11-01T02:00:00Z'))).toBe('2026-11-01')
    expect(aiUsageMonth(new Date('2026-12-31T23:59:59Z'))).toBe('2026-12-01')
  })
})
