import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PLANS, type PlanId } from './plans'

/**
 * `lib/plans.ts` and `book_limit_for_plan` are two copies of the same ladder.
 * 006 kept them in step with a comment saying to keep them in step; the free
 * row drifted from 3 to 1, `/account` drew a quota bar promising three
 * editions, the landing page sold "3 Active Editions", and the second one a
 * free author tried to make came back as HTTP 500 with a raw Postgres
 * exception. 017 realigns them. This is what stops it happening again.
 */

const master = readFileSync(join(__dirname, '..', 'supabase', 'master_migration.sql'), 'utf8')

/** Postgres has no infinity for int4, so the ladder stores int4 max. */
const INT4_MAX = 2147483647

function ladderFromSql(): Record<string, number> {
  // The master migration is a replay, so the function is defined more than once
  // and the *last* definition is the one that survives. Anchored on the CREATE
  // so a query mentioning the function elsewhere cannot be mistaken for it.
  const blocks = [
    ...master.matchAll(
      /CREATE OR REPLACE FUNCTION public\.book_limit_for_plan\(p text\)[\s\S]*?\$\$;/g
    ),
  ]
  expect(blocks.length).toBeGreaterThan(0)
  const body = blocks[blocks.length - 1][0]

  const ladder: Record<string, number> = {}
  for (const [, plan, value] of body.matchAll(/WHEN '([a-z0-9_]+)'\s*THEN\s*(\d+)/g)) {
    ladder[plan] = Number(value)
  }
  const fallback = body.match(/ELSE\s+(\d+)\s*--\s*free/)
  expect(fallback, 'the ELSE branch is the free tier and must say so').not.toBeNull()
  ladder.free = Number(fallback![1])
  return ladder
}

describe('the database ladder mirrors lib/plans.ts', () => {
  const ladder = ladderFromSql()

  it('covers every plan', () => {
    expect(Object.keys(ladder).sort()).toEqual(Object.keys(PLANS).sort())
  })

  it.each(Object.keys(PLANS) as PlanId[])('%s allows the same number of editions', (id) => {
    const inCode = PLANS[id].entitlements.maxBooks
    const expected = Number.isFinite(inCode) ? inCode : INT4_MAX
    expect(ladder[id], `book_limit_for_plan('${id}')`).toBe(expected)
  })

  it('gives the free tier three editions, which is what the pricing card sells', () => {
    // Named separately because this is the row that drifted, and because the
    // number is a public promise: components/landing/Pricing.tsx says
    // "3 Active Editions".
    const pricing = readFileSync(
      join(__dirname, '..', 'components', 'landing', 'Pricing.tsx'),
      'utf8'
    )
    const sold = pricing.match(/'(\d+) Active Editions'/)
    expect(sold, 'the free card should still state a number of editions').not.toBeNull()
    expect(Number(sold![1])).toBe(PLANS.free.entitlements.maxBooks)
    expect(ladder.free).toBe(Number(sold![1]))
  })
})
