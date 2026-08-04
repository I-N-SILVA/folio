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
