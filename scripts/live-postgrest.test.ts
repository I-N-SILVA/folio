import { describe, it, expect, beforeAll } from 'vitest'
import { randomUUID } from 'node:crypto'

/**
 * The AppSumo licence lifecycle, against a real database.
 *
 * `lib/appsumo.test.ts` asserts against a hand-rolled mock of the Supabase
 * client. That catches logic errors and cannot catch what actually bites: a
 * filter string PostgREST parses differently than the mock did, a column that
 * does not exist, an RLS policy that refuses the write. The launch runbook's
 * "dry-run one real licence" step exists because nothing else exercised this.
 *
 * Everything between the webhook and the plan on someone's account runs here
 * for real — real supabase-js, real PostgREST, real PostgreSQL, real schema —
 * with only AppSumo's own servers standing in.
 *
 * Skipped unless a live stack is pointed at it, so `npm test` is unaffected:
 *
 *   ./scripts/verify-appsumo-e2e.sh
 */

const LIVE = /127\.0\.0\.1|localhost/.test(process.env.NEXT_PUBLIC_SUPABASE_URL ?? '')

describe.skipIf(!LIVE)('the AppSumo licence lifecycle, end to end', () => {
  const KEY_T1 = `E2E-${randomUUID().slice(0, 8)}`
  const KEY_T2 = `E2E-${randomUUID().slice(0, 8)}`
  // Seeded into `auth.users` by scripts/verify-appsumo-e2e.sh, because that is
  // a schema PostgREST does not expose and creating a user is Supabase Auth's
  // job, not this app's.
  const buyer = process.env.E2E_BUYER_ID as string
  const other = process.env.E2E_OTHER_ID as string

  let applyAppSumoEvent: typeof import('@/lib/appsumo').applyAppSumoEvent
  let redeemLicense: typeof import('@/lib/appsumo').redeemLicense
  let admin: typeof import('@/lib/supabase').supabaseAdmin

  const planOf = async (id: string) => {
    const { data } = await admin.from('profiles').select('plan, status, appsumo_tier').eq('id', id).maybeSingle()
    return (data ?? {}) as { plan?: string; status?: string; appsumo_tier?: number }
  }

  beforeAll(async () => {
    const mod = await import('@/lib/appsumo')
    applyAppSumoEvent = mod.applyAppSumoEvent
    redeemLicense = mod.redeemLicense
    admin = (await import('@/lib/supabase')).supabaseAdmin

    // The 004 signup trigger should already have made both profiles. If it has
    // not, everything below fails for a reason worth naming here instead.
    for (const id of [buyer, other]) {
      const { data } = await admin.from('profiles').select('id').eq('id', id).maybeSingle()
      if (!data) throw new Error(`no profile for ${id} — handle_new_user did not fire`)
    }
  })

  it('activate creates an unredeemed tier-1 licence', async () => {
    const r = await applyAppSumoEvent({
      action: 'activate',
      license_key: KEY_T1,
      tier: 1,
      activation_email: 'buyer@example.com',
    })
    expect(r.ok).toBe(true)
    const { data } = await admin
      .from('appsumo_licenses')
      .select('plan, status, redeemed_by')
      .eq('license_key', KEY_T1)
      .maybeSingle()
    expect(data).toMatchObject({ plan: 'ltd_tier1', status: 'active', redeemed_by: null })
  })

  it('the buyer redeems it and lands on tier 1', async () => {
    const r = await redeemLicense(buyer, KEY_T1)
    expect(r.ok).toBe(true)
    expect(await planOf(buyer)).toMatchObject({ plan: 'ltd_tier1', appsumo_tier: 1 })
  })

  it('a second account cannot claim the same code', async () => {
    // The money case: one licence, two paid accounts.
    const r = await redeemLicense(other, KEY_T1)
    expect(r).toMatchObject({ ok: false, reason: 'already_redeemed' })
    expect((await planOf(other)).plan ?? 'free').toBe('free')
  })

  it('the holder retrying still succeeds', async () => {
    // A dropped response must not read as "already used" to its owner.
    expect((await redeemLicense(buyer, KEY_T1)).ok).toBe(true)
  })

  it('stacking a code carries the redemption to the new key', async () => {
    const r = await applyAppSumoEvent({
      action: 'enhance',
      license_key: KEY_T2,
      prev_license_key: KEY_T1,
      tier: 2,
    })
    expect(r.ok).toBe(true)

    const { data: fresh } = await admin
      .from('appsumo_licenses')
      .select('plan, redeemed_by')
      .eq('license_key', KEY_T2)
      .maybeSingle()
    expect(fresh).toMatchObject({ plan: 'ltd_tier2', redeemed_by: buyer })

    const { data: old } = await admin
      .from('appsumo_licenses')
      .select('status')
      .eq('license_key', KEY_T1)
      .maybeSingle()
    expect(old).toMatchObject({ status: 'deactivated' })

    // And it takes effect without the buyer redeeming anything again.
    expect(await planOf(buyer)).toMatchObject({ plan: 'ltd_tier2', appsumo_tier: 2 })
  })

  it('reduce moves them back down', async () => {
    await applyAppSumoEvent({ action: 'reduce', license_key: KEY_T2, tier: 1 })
    expect((await planOf(buyer)).plan).toBe('ltd_tier1')
  })

  it('refund reverts the buyer to Free', async () => {
    // The entire answer to AppSumo's 60-day refund window.
    const r = await applyAppSumoEvent({ action: 'refund', license_key: KEY_T2, tier: 1 })
    expect(r.ok).toBe(true)
    expect(await planOf(buyer)).toMatchObject({ plan: 'free', status: 'refunded' })
  })

  it('a refunded code is dead to everyone', async () => {
    expect(await redeemLicense(other, KEY_T2)).toMatchObject({ ok: false, reason: 'refunded' })
  })
})

/**
 * The digest's slot claim.
 *
 * Same shape as the licence claim and same original bug: a `.or()` on an
 * UPDATE carrying a `select=`, which PostgREST re-applies to a CTE that does
 * not have the column. It failed for every profile on every run, and the route
 * read that as "already claimed" — so the weekly digest has never sent an
 * email to anybody. See migration 016.
 */
describe.skipIf(!LIVE)('the weekly digest slot claim', () => {
  const user = process.env.E2E_OTHER_ID as string
  let admin: typeof import('@/lib/supabase').supabaseAdmin

  beforeAll(async () => {
    admin = (await import('@/lib/supabase')).supabaseAdmin
    await admin.from('profiles').update({ digest_last_sent_at: null }).eq('id', user)
  })

  const claim = (due: string) => admin.rpc('claim_digest_slot', { p_user_id: user, p_due: due })
  const future = () => new Date(Date.now() + 60_000).toISOString()

  it('claims a slot that has never been claimed', async () => {
    const { data, error } = await claim(future())
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('refuses a second claim in the same window', async () => {
    // The idempotency the whole design rests on: a retry, an overlapping run,
    // or a curious operator running the cron by hand must not double-send.
    const { data, error } = await claim(new Date(Date.now() - 6 * 24 * 3600_000).toISOString())
    expect(error).toBeNull()
    expect(data).toHaveLength(0)
  })

  it('claims again once the profile is due', async () => {
    const { data, error } = await claim(future())
    expect(error).toBeNull()
    expect(data).toHaveLength(1)
  })

  it('leaves other profiles alone', async () => {
    const buyer = process.env.E2E_BUYER_ID as string
    const { data } = await admin.from('profiles').select('digest_last_sent_at').eq('id', buyer).maybeSingle()
    expect((data as { digest_last_sent_at?: string })?.digest_last_sent_at ?? null).toBeNull()
  })
})
