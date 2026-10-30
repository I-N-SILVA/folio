import { describe, it, expect, vi } from 'vitest'

vi.mock('server-only', () => ({}))
vi.mock('@/lib/supabase', () => ({ supabaseAdmin: {} }))

import { dailyLimitFor } from './email-quota'

describe('dailyLimitFor', () => {
  it('counts nothing on a paid plan, where no limit is set', () => {
    expect(dailyLimitFor('digest', {})).toBeNull()
    expect(dailyLimitFor('notice', {})).toBeNull()
  })

  it('keeps room for lead notifications inside a free plan', () => {
    // Resend free: 100 a day. 95 keeps a 30-day month under 3,000 too.
    const env = { EMAIL_DAILY_LIMIT: '95' }
    expect(dailyLimitFor('notice', env)).toBe(95)
    expect(dailyLimitFor('digest', env)).toBe(75)
  })

  it('takes an explicit digest share, but never more than the total', () => {
    expect(dailyLimitFor('digest', { EMAIL_DAILY_LIMIT: '95', DIGEST_DAILY_LIMIT: '50' })).toBe(50)
    expect(dailyLimitFor('digest', { EMAIL_DAILY_LIMIT: '95', DIGEST_DAILY_LIMIT: '500' })).toBe(95)
  })

  it('ignores nonsense rather than refusing every email', () => {
    expect(dailyLimitFor('notice', { EMAIL_DAILY_LIMIT: 'lots' })).toBeNull()
    expect(dailyLimitFor('notice', { EMAIL_DAILY_LIMIT: '0' })).toBeNull()
    expect(dailyLimitFor('digest', { EMAIL_DAILY_LIMIT: '10' })).toBe(0)
  })
})
