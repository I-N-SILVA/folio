import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import crypto from 'node:crypto'
import { normalizeAction, verifyAppSumoSignature } from './appsumo'

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

  it('accepts a v2 signature, which covers the timestamp and the body', () => {
    // AppSumo v2 signs `timestamp . body` with no separator. This verified the
    // body alone, so every v2 webhook got a 401 — AppSumo retries a non-2xx,
    // so the queue would have filled with events that could never be accepted
    // and no licence would ever have been created.
    const body = JSON.stringify({ event: 'purchase', license_key: 'abc', tier: 1 })
    const ts = '1788660000'
    const v2 = crypto.createHmac('sha256', KEY).update(`${ts}${body}`, 'utf8').digest('hex')

    expect(verifyAppSumoSignature(body, v2, ts)).toBe(true)
  })

  it('still accepts a v1 signature over the body alone', () => {
    // Which construction arrives is the deal's API version, not the caller's
    // choice, so both have to work.
    const body = JSON.stringify({ action: 'activate', license_key: 'abc' })
    expect(verifyAppSumoSignature(body, sign(body), '1788660000')).toBe(true)
    expect(verifyAppSumoSignature(body, sign(body), null)).toBe(true)
  })

  it('does not accept a v2 signature made with a different timestamp', () => {
    const body = JSON.stringify({ event: 'purchase', license_key: 'abc' })
    const signed = crypto.createHmac('sha256', KEY).update(`111${body}`, 'utf8').digest('hex')
    expect(verifyAppSumoSignature(body, signed, '222')).toBe(false)
  })

  it('does not accept a timestamp appended rather than prepended', () => {
    // Order matters and is not guessable from the header alone: the reference
    // implementation is `$timestamp . $request->getContent()`.
    const body = JSON.stringify({ event: 'purchase', license_key: 'abc' })
    const ts = '1788660000'
    const wrongWayRound = crypto.createHmac('sha256', KEY).update(`${body}${ts}`, 'utf8').digest('hex')
    expect(verifyAppSumoSignature(body, wrongWayRound, ts)).toBe(false)
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

/**
 * Minimal stand-in for the client, recording the RPC call.
 *
 * A mock is all this file can be, and it is worth being explicit about what
 * that buys and what it does not. The claim used to be expressed as a
 * PostgREST filter chain and this mock accepted it happily — while the real
 * PostgREST answered `42703` and every redemption in production would have
 * failed. `scripts/appsumo-e2e.test.ts` runs the same code against a real
 * PostgREST for exactly that reason; these tests cover the branching around
 * it, which that one is too slow to enumerate.
 */
function makeAdmin({
  read,
  claimed,
  rpcError,
}: {
  read: Record<string, unknown> | null
  claimed: Record<string, unknown>[]
  rpcError?: { message: string }
}) {
  const calls: { fn: string; args: Record<string, unknown> }[] = []
  const builder: Record<string, any> = {
    select: () => builder,
    update: () => builder,
    eq: () => builder,
    neq: () => builder,
    maybeSingle: async () => ({ data: read }),
    then: (resolve: (v: unknown) => unknown) => resolve({ data: null, error: null }),
  }
  return {
    from: () => builder,
    rpc: async (fn: string, args: Record<string, unknown>) => {
      calls.push({ fn, args })
      return rpcError ? { data: null, error: rpcError } : { data: claimed, error: null }
    },
    calls,
  }
}

describe('normalizeAction — both AppSumo payload shapes', () => {
  it('reads the v1 `action` field', () => {
    for (const [raw, expected] of [
      ['activate', 'activate'],
      ['enhance', 'enhance'],
      ['reduce', 'reduce'],
      ['refund', 'refund'],
      ['test', 'test'],
    ] as const) {
      expect(normalizeAction({ action: raw })).toBe(expected)
    }
  })

  it('reads the v2 `event` field', () => {
    // This file was written for v1 and read `action` only. On a v2 deal that is
    // undefined, so the route answered 400 and *every* webhook was rejected —
    // no licence row, ever, and every buyer's code did not exist.
    for (const [raw, expected] of [
      ['purchase', 'activate'],
      ['activate', 'activate'],
      ['upgrade', 'enhance'],
      ['downgrade', 'reduce'],
      ['deactivate', 'refund'],
    ] as const) {
      expect(normalizeAction({ event: raw })).toBe(expected)
    }
  })

  it('prefers `event` when a payload somehow carries both', () => {
    expect(normalizeAction({ event: 'deactivate', action: 'activate' })).toBe('refund')
  })

  it('is not case- or whitespace-sensitive', () => {
    expect(normalizeAction({ event: '  Deactivate ' })).toBe('refund')
  })

  it('returns null for a verb neither version defines', () => {
    // `migrate` is v2's deal add-on event and this product sells no add-ons.
    expect(normalizeAction({ event: 'migrate' })).toBeNull()
    expect(normalizeAction({ event: 'something_new' })).toBeNull()
    expect(normalizeAction({})).toBeNull()
  })
})

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

  it('claims through the database function, not a PostgREST filter', async () => {
    // The filter form compiled to SQL that referenced a column the CTE did not
    // return, so Postgres rejected every claim and the buyer was told their
    // code did not exist. See migration 015.
    const admin = makeAdmin({ read: licenseRow, claimed: [{ license_key: 'KEY-1', plan: 'ltd_tier1' }] })
    const redeem = await load(admin)
    await redeem(USER, 'KEY-1')

    expect(admin.calls).toHaveLength(1)
    expect(admin.calls[0]).toEqual({
      fn: 'claim_appsumo_license',
      args: { p_license_key: 'KEY-1', p_user_id: USER },
    })
  })

  it('reports a claim the database refused rather than claiming success', async () => {
    // The only ways here are an unapplied migration or an unreachable database,
    // and both must not read as "redeemed".
    const admin = makeAdmin({
      read: licenseRow,
      claimed: [],
      rpcError: { message: 'function public.claim_appsumo_license does not exist' },
    })
    const redeem = await load(admin)
    expect(await redeem(USER, 'KEY-1')).toMatchObject({ ok: false, reason: 'not_found' })
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

// ─── Webhook application ──────────────────────────────────────────────────────
//
// The webhook must never un-link a license its buyer already redeemed. That
// matters more now that redeeming is gated on `redeemed_by IS NULL`: an
// un-linked license is claimable by anyone.

/** Records every write so a test can assert what the upsert did and didn't touch. */
function makeWebhookAdmin(rows: Record<string, Record<string, unknown>>) {
  const writes: { op: string; table: string; payload: Record<string, unknown>; filters: string[] }[] = []

  function builderFor(table: string) {
    const filters: string[] = []
    let op = 'select'
    let payload: Record<string, unknown> = {}
    let key: string | null = null

    const b: Record<string, any> = {
      select: () => b,
      update: (p: Record<string, unknown>) => {
        op = 'update'
        payload = p
        return b
      },
      upsert: (p: Record<string, unknown>) => {
        op = 'upsert'
        payload = p
        writes.push({ op, table, payload, filters: [...filters] })
        const k = p.license_key as string
        rows[k] = { ...(rows[k] ?? {}), ...p }
        return Promise.resolve({ data: null, error: null })
      },
      eq: (col: string, val: string) => {
        filters.push(`eq:${col}=${val}`)
        if (col === 'license_key') key = val
        return b
      },
      is: (col: string, val: unknown) => {
        filters.push(`is:${col}=${String(val)}`)
        return b
      },
      maybeSingle: async () => ({ data: key ? (rows[key] ?? null) : null }),
      then: (resolve: (v: unknown) => unknown) => {
        if (op === 'update') writes.push({ op, table, payload, filters: [...filters] })
        return resolve({ data: null, error: null })
      },
    }
    return b
  }

  return { admin: { from: (t: string) => builderFor(t) }, writes }
}

describe('applyAppSumoEvent', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.stubEnv('APPSUMO_API_KEY', KEY)
  })
  afterEach(() => vi.unstubAllEnvs())

  async function load(admin: { from: (t: string) => unknown }) {
    vi.doMock('@/lib/supabase', () => ({ supabaseAdmin: admin }))
    return (await import('./appsumo')).applyAppSumoEvent
  }

  it('never writes redeemed_by in the license upsert', async () => {
    // The old version read redeemed_by and wrote it back, so a redemption
    // landing in between was overwritten with null.
    const { admin, writes } = makeWebhookAdmin({
      'KEY-1': { license_key: 'KEY-1', redeemed_by: 'user-abc' },
    })
    const apply = await load(admin)
    await apply({ action: 'enhance', license_key: 'KEY-1', tier: 2 })

    const upsert = writes.find((w) => w.op === 'upsert')
    expect(upsert).toBeDefined()
    expect(Object.keys(upsert!.payload)).not.toContain('redeemed_by')
  })

  it('leaves an existing redemption in place across a tier change', async () => {
    const rows: Record<string, Record<string, unknown>> = {
      'KEY-1': { license_key: 'KEY-1', redeemed_by: 'user-abc' },
    }
    const { admin } = makeWebhookAdmin(rows)
    const apply = await load(admin)
    await apply({ action: 'enhance', license_key: 'KEY-1', tier: 3 })
    expect(rows['KEY-1'].redeemed_by).toBe('user-abc')
  })

  it('carries the redemption onto a new key only while that key is unclaimed', async () => {
    const { admin, writes } = makeWebhookAdmin({
      'OLD-KEY': { license_key: 'OLD-KEY', redeemed_by: 'user-abc', redeemed_at: 't0' },
      'NEW-KEY': { license_key: 'NEW-KEY', redeemed_by: null },
    })
    const apply = await load(admin)
    await apply({ action: 'enhance', license_key: 'NEW-KEY', prev_license_key: 'OLD-KEY', tier: 3 })

    const carry = writes.find((w) => w.op === 'update' && 'redeemed_by' in w.payload)
    expect(carry).toBeDefined()
    expect(carry!.payload.redeemed_by).toBe('user-abc')
    // Guarded, so a redemption racing the carry-over is not overwritten.
    expect(carry!.filters).toContain('is:redeemed_by=null')
  })

  it('reverts a refunded buyer to Free', async () => {
    // AppSumo's refund window is 60 days and the launch plan's whole answer to
    // refund abuse is that this webhook takes the entitlements back. Untested,
    // that answer is a hope.
    const { admin, writes } = makeWebhookAdmin({
      'KEY-1': { license_key: 'KEY-1', redeemed_by: 'user-abc', plan: 'ltd_tier3', status: 'active' },
    })
    const apply = await load(admin)
    const result = await apply({ action: 'refund', license_key: 'KEY-1', tier: 3 })

    expect(result.ok).toBe(true)
    // The license is marked refunded...
    const upsert = writes.find((w) => w.op === 'upsert')
    expect(upsert!.payload.status).toBe('refunded')
    // ...and the buyer's profile goes back to Free, not left on tier 3.
    const profile = writes.find((w) => w.table === 'profiles' && w.op === 'update')
    expect(profile, 'no profile write — a refunded buyer keeps their plan').toBeDefined()
    expect(profile!.payload.plan).toBe('free')
    expect(profile!.payload.status).toBe('refunded')
    expect(profile!.filters).toContain('eq:id=user-abc')
  })

  it('does not touch a profile when the license was never redeemed', async () => {
    // A refund for a code nobody claimed has no user to demote, and writing a
    // profile row keyed on null would be a bug looking for somewhere to happen.
    const { admin, writes } = makeWebhookAdmin({
      'KEY-1': { license_key: 'KEY-1', redeemed_by: null, status: 'active' },
    })
    const apply = await load(admin)
    await apply({ action: 'refund', license_key: 'KEY-1', tier: 1 })
    expect(writes.filter((w) => w.table === 'profiles')).toEqual([])
  })

  it('moves a buyer up when they stack a code', async () => {
    // `enhance` is how AppSumo represents a stacked purchase, and it is the
    // path most likely to leave someone paying tier 2 money for tier 1 limits.
    const { admin, writes } = makeWebhookAdmin({
      'KEY-1': { license_key: 'KEY-1', redeemed_by: 'user-abc', plan: 'ltd_tier1', status: 'active' },
    })
    const apply = await load(admin)
    await apply({ action: 'enhance', license_key: 'KEY-1', tier: 2 })

    expect(writes.find((w) => w.op === 'upsert')!.payload.plan).toBe('ltd_tier2')
    const profile = writes.find((w) => w.table === 'profiles' && w.op === 'update')
    expect(profile!.payload.plan).toBe('ltd_tier2')
  })

  it('applies a v2 payload as readily as a v1 one', async () => {
    // The parser test above covers the mapping; this covers the path, because
    // a correct mapping that nothing calls is exactly the bug being fixed.
    const { admin, writes } = makeWebhookAdmin({})
    const apply = await load(admin)
    const result = await apply({ event: 'purchase', license_key: 'V2-KEY', tier: 3 })

    expect(result.ok).toBe(true)
    const upsert = writes.find((w) => w.op === 'upsert')
    expect(upsert!.payload).toMatchObject({ license_key: 'V2-KEY', plan: 'ltd_tier3', status: 'active' })
  })

  it('marks a v2 deactivate as refunded', async () => {
    const { admin, writes } = makeWebhookAdmin({
      'V2-KEY': { license_key: 'V2-KEY', redeemed_by: 'user-abc' },
    })
    const apply = await load(admin)
    await apply({ event: 'deactivate', license_key: 'V2-KEY', tier: 1 })
    expect(writes.find((w) => w.op === 'upsert')!.payload.status).toBe('refunded')
  })

  it('ignores a verb it does not understand without erroring', async () => {
    // AppSumo retries a non-2xx, so failing on `migrate` would fill their queue
    // with something we will never handle. Do nothing, say so, answer 200.
    const { admin, writes } = makeWebhookAdmin({})
    const apply = await load(admin)
    const result = await apply({ event: 'migrate', license_key: 'ADDON-1', tier: 1 })

    expect(result.ok).toBe(true)
    expect(result.message).toContain('ignored')
    expect(writes).toEqual([])
  })

  it('reports a missing license key', async () => {
    const { admin } = makeWebhookAdmin({})
    const apply = await load(admin)
    await expect(apply({ action: 'activate' })).resolves.toEqual({
      ok: false,
      message: 'missing license_key',
    })
  })

  it('short-circuits AppSumo test pings', async () => {
    const { admin, writes } = makeWebhookAdmin({})
    const apply = await load(admin)
    await expect(apply({ action: 'test' })).resolves.toEqual({ ok: true, message: 'test ok' })
    expect(writes).toHaveLength(0)
  })
})
