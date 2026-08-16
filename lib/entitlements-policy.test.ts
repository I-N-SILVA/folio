import { describe, expect, it } from 'vitest'
import { readerPolicy } from './entitlements'
import { PLANS, clampAnalyticsDays } from './plans'

// These cover the enforcement that the plan catalog claims and the product used
// not to do: seven of its eight entitlements were checked nowhere, so the
// pricing page sold features every free account already had.

describe('readerPolicy — the badge', () => {
  it('shows the badge on a plan without white-label, whatever the book says', () => {
    // The regression that matters: `whitelabel` is an author-controlled toggle
    // the editor offered to every account, so a free user could remove the
    // badge — losing both the upgrade reason and the growth loop.
    const policy = readerPolicy({ whitelabel: true }, PLANS.free.entitlements)
    expect(policy.showBadge).toBe(true)
  })

  it('hides the badge only when the plan allows it and the author asked', () => {
    expect(readerPolicy({ whitelabel: true }, PLANS.pro.entitlements).showBadge).toBe(false)
    expect(readerPolicy({ whitelabel: false }, PLANS.pro.entitlements).showBadge).toBe(true)
  })

  it('shows the badge when the book has no settings at all', () => {
    expect(readerPolicy(null, PLANS.pro.entitlements).showBadge).toBe(true)
    expect(readerPolicy(undefined, PLANS.free.entitlements).showBadge).toBe(true)
  })

  it('keeps the badge on LTD tier 1, which does not include white-label', () => {
    expect(readerPolicy({ whitelabel: true }, PLANS.ltd_tier1.entitlements).showBadge).toBe(true)
    expect(readerPolicy({ whitelabel: true }, PLANS.ltd_tier2.entitlements).showBadge).toBe(false)
  })
})

describe('readerPolicy — the lead gate', () => {
  it('does not gate for a plan without lead capture', () => {
    const policy = readerPolicy({ gating: { enabled: true } }, PLANS.free.entitlements)
    expect(policy.gateEnabled).toBe(false)
  })

  it('gates when the plan includes it and the author switched it on', () => {
    expect(readerPolicy({ gating: { enabled: true } }, PLANS.pro.entitlements).gateEnabled).toBe(true)
  })

  it('does not gate when the author left it off, on any plan', () => {
    expect(readerPolicy({ gating: { enabled: false } }, PLANS.pro.entitlements).gateEnabled).toBe(false)
    expect(readerPolicy({}, PLANS.pro.entitlements).gateEnabled).toBe(false)
  })
})

describe('clampAnalyticsDays', () => {
  it('clamps a request beyond the plan window', () => {
    expect(clampAnalyticsDays(365, PLANS.free.entitlements)).toBe(30)
  })

  it('honours a request inside the plan window', () => {
    expect(clampAnalyticsDays(7, PLANS.free.entitlements)).toBe(7)
    expect(clampAnalyticsDays(90, PLANS.pro.entitlements)).toBe(90)
  })

  it('treats "all time" as the plan window rather than everything', () => {
    // The range picker used to send `all` straight into the query, which is how
    // a 30-day plan returned every event it had ever recorded.
    expect(clampAnalyticsDays(null, PLANS.free.entitlements)).toBe(30)
    expect(clampAnalyticsDays(null, PLANS.pro.entitlements)).toBe(365)
  })

  it('falls back to the plan window for nonsense input', () => {
    expect(clampAnalyticsDays(0, PLANS.free.entitlements)).toBe(30)
    expect(clampAnalyticsDays(-90, PLANS.free.entitlements)).toBe(30)
    expect(clampAnalyticsDays(Number.NaN, PLANS.pro.entitlements)).toBe(365)
    expect(clampAnalyticsDays(Infinity, PLANS.pro.entitlements)).toBe(365)
  })
})

describe('plan catalog', () => {
  it('gives every plan PDF import by making it unmetered', () => {
    // Import is the promise on the landing page. It used to be `pdfImport:
    // false` on Free while the hero sold it, and nothing enforced the flag
    // either way — so the entitlement was removed rather than left as a lie.
    expect('pdfImport' in PLANS.free.entitlements).toBe(false)
  })

  it('does not declare an entitlement for a feature that does not exist', () => {
    // `customDomain` was sold on the pricing page, the FAQ and the account page
    // with no domain routing anywhere in the app.
    expect('customDomain' in PLANS.pro.entitlements).toBe(false)
  })

  it('leaves room on Free to publish something real', () => {
    // One edition meant a single abandoned import — which strands a book
    // holding a slug and a quota slot — bricked the account.
    expect(PLANS.free.entitlements.maxBooks).toBeGreaterThan(1)
  })
})
