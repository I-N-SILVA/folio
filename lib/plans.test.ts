import { describe, it, expect } from 'vitest'
import {
  getPlan,
  getEntitlements,
  isValidPlan,
  planFromAppSumoTier,
  formatQuota,
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
    expect(getEntitlements('pro').maxBooks).toBe(Infinity)
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

  it('clamps out-of-range tiers to the top tier rather than crashing', () => {
    expect(planFromAppSumoTier(99)).toBe('ltd_tier3')
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
