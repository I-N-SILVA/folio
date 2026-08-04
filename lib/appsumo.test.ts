import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import crypto from 'node:crypto'
import { verifyAppSumoSignature } from './appsumo'

const KEY = 'test-secret-key'

function sign(body: string, key = KEY): string {
  return crypto.createHmac('sha256', key).update(body, 'utf8').digest('hex')
}

describe('verifyAppSumoSignature', () => {
  beforeEach(() => {
    vi.stubEnv('APPSUMO_API_KEY', KEY)
    vi.stubEnv('NODE_ENV', 'test')
  })

  afterEach(() => {
    vi.unstubAllEnvs()
  })

  it('accepts a correctly signed body', () => {
    const body = JSON.stringify({ action: 'activate', license_key: 'abc' })
    expect(verifyAppSumoSignature(body, sign(body))).toBe(true)
  })

  it('rejects a tampered body', () => {
    const body = JSON.stringify({ action: 'activate', license_key: 'abc' })
    const sig = sign(body)
    expect(verifyAppSumoSignature(body + 'x', sig)).toBe(false)
  })

  it('rejects a signature made with the wrong key', () => {
    const body = JSON.stringify({ action: 'refund' })
    expect(verifyAppSumoSignature(body, sign(body, 'other-key'))).toBe(false)
  })

  it('rejects a missing signature', () => {
    expect(verifyAppSumoSignature('{}', null)).toBe(false)
  })

  it('rejects a length-mismatched signature without throwing', () => {
    const body = '{}'
    expect(verifyAppSumoSignature(body, 'deadbeef')).toBe(false)
  })

  it('fails closed in production when no key is configured', () => {
    vi.stubEnv('APPSUMO_API_KEY', '')
    vi.stubEnv('NODE_ENV', 'production')
    expect(verifyAppSumoSignature('{}', sign('{}'))).toBe(false)
  })
})

// ─── License claiming ─────────────────────────────────────────────────────────
//
// A license grants a paid plan, so the thing that decides who gets it must be a
// single conditional write, not a read followed by an unconditional write. These
// cover the outcomes that write produces.

const licenseRow = { license_key: 'KEY-1', plan: 'ltd_tier2', status: 'active', redeemed_by: null }
const USER = '11111111-2222-3333-4444-555555555555'
const OTHER = '99999999-8888-7777-6666-555555555555'

/** Minimal stand-in for the query builder, recording the filters applied. */
function makeAdmin({
  read,
  claimed,
}: {
  read: Record<string, unknown> | null
  claimed: Record<string, unknown>[]
}) {
  const filters: string[] = []
  const builder: Record<string, any> = {
    select: () => builder,
    update: () => builder,
    eq: (col: string) => {
      filters.push(`eq:${col}`)
      return builder
    },
    neq: (col: string, val: string) => {
      filters.push(`neq:${col}=${val}`)
      return builder
    },
    or: (expr: string) => {
      filters.push(`or:${expr}`)
      return builder
    },
    maybeSingle: async () => ({ data: read }),
    then: (resolve: (v: unknown) => unknown) => resolve({ data: claimed, error: null }),
  }
  return { from: () => builder, filters }
}

describe('redeemLicense', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  async function load(admin: { from: () => unknown }) {
    vi.doMock('@/lib/supabase', () => ({ supabaseAdmin: admin }))
    return (await import('./appsumo')).redeemLicense
  }

  it('claims a license when the conditional write wins', async () => {
    const admin = makeAdmin({ read: licenseRow, claimed: [{ license_key: 'KEY-1', plan: 'ltd_tier2' }] })
    const redeem = await load(admin)
    await expect(redeem(USER, ' KEY-1 ')).resolves.toEqual({ ok: true, plan: 'ltd_tier2' })
  })

  it('refuses when the write matches no rows — someone else won the race', async () => {
    // The read still shows the license as unclaimed, which is exactly the
    // window the old check-then-update version treated as success.
    const admin = makeAdmin({ read: licenseRow, claimed: [] })
    const redeem = await load(admin)
    await expect(redeem(USER, 'KEY-1')).resolves.toEqual({
      ok: false,
      reason: 'already_redeemed',
    })
  })

  it('scopes the claim to unclaimed rows and excludes refunds', async () => {
    const admin = makeAdmin({ read: licenseRow, claimed: [{ license_key: 'KEY-1', plan: 'ltd_tier2' }] })
    const redeem = await load(admin)
    await redeem(USER, 'KEY-1')
    expect(admin.filters).toContain('neq:status=refunded')
    expect(admin.filters.some((f) => f.startsWith('or:redeemed_by.is.null'))).toBe(true)
  })

  it('reports an unknown code', async () => {
    const redeem = await load(makeAdmin({ read: null, claimed: [] }))
    await expect(redeem(USER, 'NOPE')).resolves.toEqual({ ok: false, reason: 'not_found' })
  })

  it('reports a refunded license before attempting a claim', async () => {
    const redeem = await load(makeAdmin({ read: { ...licenseRow, status: 'refunded' }, claimed: [] }))
    await expect(redeem(USER, 'KEY-1')).resolves.toEqual({ ok: false, reason: 'refunded' })
  })

  it("reports a license already held by another account", async () => {
    const redeem = await load(makeAdmin({ read: { ...licenseRow, redeemed_by: OTHER }, claimed: [] }))
    await expect(redeem(USER, 'KEY-1')).resolves.toEqual({
      ok: false,
      reason: 'already_redeemed',
    })
  })

  it('rejects a user id that is not a uuid rather than building a filter from it', async () => {
    const redeem = await load(makeAdmin({ read: licenseRow, claimed: [] }))
    await expect(redeem('not-a-uuid', 'KEY-1')).resolves.toEqual({
      ok: false,
      reason: 'not_found',
    })
  })
})
