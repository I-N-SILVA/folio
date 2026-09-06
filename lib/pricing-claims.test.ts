import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLANS, formatQuota, type Entitlements } from '@/lib/plans'

/**
 * What the landing page sells against what a plan actually grants.
 *
 * `HANDOVER` §2b is titled "The plans were decorative": the pricing page listed
 * four features nothing enforced, one of which was not built. It happened again
 * with live data — sold as a Pro feature since it existed, ungated for
 * everyone — and on the Lifetime card, which said "Everything in Pro" when
 * Tier 1 is 10 editions, 90 days of analytics and the QLICO badge still on the
 * reader. On an AppSumo listing that is a refund and a one-taco review.
 *
 * Nothing catches this: the pricing page is a literal array of strings, and no
 * type connects it to `lib/plans.ts`. So this reads the strings.
 */

const PRICING = readFileSync(join(process.cwd(), 'components', 'landing', 'Pricing.tsx'), 'utf8')

/** The feature bullets of one named card on the pricing page. */
function featuresOf(planName: string): string[] {
  const card = new RegExp(`name: '${planName}'[\\s\\S]*?features: \\[([\\s\\S]*?)\\]`, 'm').exec(PRICING)
  if (!card) throw new Error(`No "${planName}" card on the pricing page`)
  return [...card[1].matchAll(/'([^']+)'/g)].map((m) => m[1])
}

/** Whether any bullet mentions a thing, loosely. */
const claims = (features: string[], needle: RegExp) => features.some((f) => needle.test(f))

describe('the pricing page against lib/plans.ts', () => {
  it('states the Free edition cap the code enforces', () => {
    const bullets = featuresOf('Free').join(' | ')
    expect(bullets).toContain(formatQuota(PLANS.free.entitlements.maxBooks))
    expect(bullets).toContain(String(PLANS.free.entitlements.analyticsDays))
  })

  it('does not sell Free anything Free does not get', () => {
    const free = featuresOf('Free')
    const e: Entitlements = PLANS.free.entitlements
    if (!e.csvExport) expect(claims(free, /csv|export/i), 'Free is sold CSV export').toBe(false)
    if (!e.liveData) expect(claims(free, /live data/i), 'Free is sold live data').toBe(false)
    // Free keeps the badge, and the card is expected to say so rather than stay
    // quiet about it.
    if (!e.whiteLabel) expect(claims(free, /watermark|badge/i)).toBe(true)
  })

  it('only sells Pro what Pro actually has', () => {
    const pro = featuresOf('Pro')
    const e = PLANS.pro.entitlements
    if (claims(pro, /live data/i)) expect(e.liveData, 'Pro is sold live data it does not have').toBe(true)
    if (claims(pro, /csv|export/i)) expect(e.csvExport).toBe(true)
    if (claims(pro, /badge|watermark/i)) expect(e.whiteLabel).toBe(true)
    if (claims(pro, /unlimited/i)) expect(e.maxBooks).toBe(Infinity)
  })

  it('does not claim the lifetime tiers match Pro', () => {
    // Tier 1 is the entry price and the one most buyers take. It is smaller
    // than Pro on three of five entitlements, so "Everything in Pro" is false
    // for the majority of the people reading it.
    const lifetime = featuresOf('Lifetime').join(' | ')
    const t1 = PLANS.ltd_tier1.entitlements
    const pro = PLANS.pro.entitlements

    const smallerThanPro =
      t1.maxBooks < pro.maxBooks || t1.analyticsDays < pro.analyticsDays || (!t1.whiteLabel && pro.whiteLabel)

    if (smallerThanPro) {
      expect(/everything in pro/i.test(lifetime), '"Everything in Pro" is not true of Tier 1').toBe(false)
    }
  })

  it('states the entry tier honestly', () => {
    const lifetime = featuresOf('Lifetime').join(' | ')
    expect(lifetime).toContain(formatQuota(PLANS.ltd_tier1.entitlements.maxBooks))
    expect(lifetime).toContain(String(PLANS.ltd_tier1.entitlements.analyticsDays))
    // And that stacking is how you get past it, because AppSumo buyers stack.
    expect(/stack/i.test(lifetime)).toBe(true)
  })

  it('does not promise support tiers nothing backs', () => {
    // "Priority Creator Support" was on the Lifetime card. There is no support
    // tier in the product, no queue and no SLA — one shared inbox. Promising a
    // priority lane to lifetime buyers is a commitment nobody can keep.
    for (const plan of ['Free', 'Pro', 'Lifetime']) {
      expect(
        claims(featuresOf(plan), /priority .*support|dedicated support|24\/7/i),
        `${plan} promises a support tier the product does not have`
      ).toBe(false)
    }
  })
})

describe('every entitlement is enforced somewhere', () => {
  it('has a doc comment naming where', () => {
    // The entitlement type carries "Enforced: <route>" on each field, which is
    // the only thing tying a plan to the code. A new entitlement without one is
    // how "decorative" starts.
    const src = readFileSync(join(process.cwd(), 'lib', 'plans.ts'), 'utf8')
    const type = /export type Entitlements = \{([\s\S]*?)\n\}/.exec(src)
    expect(type, 'could not find the Entitlements type').not.toBeNull()

    const fields = [...type![1].matchAll(/^\s{2}(\w+):/gm)].map((m) => m[1])
    expect(fields.length).toBe(Object.keys(PLANS.free.entitlements).length)

    for (const field of fields) {
      const block = new RegExp(`([\\s\\S]{0,600}?)\\n\\s{2}${field}:`).exec(type![1])
      expect(/Enforced:/i.test(block?.[1] ?? ''), `${field} does not say where it is enforced`).toBe(true)
    }
  })
})
