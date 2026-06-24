import { describe, it, expect } from 'vitest'
import { rateLimit, clientIp } from './rate-limit'

describe('rateLimit', () => {
  it('allows requests up to the limit then blocks', () => {
    const key = `test-${Math.random()}`
    for (let i = 0; i < 3; i++) {
      expect(rateLimit(key, 3, 60_000).ok).toBe(true)
    }
    const blocked = rateLimit(key, 3, 60_000)
    expect(blocked.ok).toBe(false)
    expect(blocked.retryAfter).toBeGreaterThan(0)
  })

  it('keeps separate windows per key', () => {
    const a = `a-${Math.random()}`
    const b = `b-${Math.random()}`
    expect(rateLimit(a, 1, 60_000).ok).toBe(true)
    expect(rateLimit(a, 1, 60_000).ok).toBe(false)
    // b is untouched by a's exhaustion
    expect(rateLimit(b, 1, 60_000).ok).toBe(true)
  })

  it('resets after the window elapses', () => {
    const key = `reset-${Math.random()}`
    expect(rateLimit(key, 1, 1).ok).toBe(true)
    // window of 1ms — a tiny busy wait guarantees expiry
    const start = Date.now()
    while (Date.now() - start < 5) {
      /* spin */
    }
    expect(rateLimit(key, 1, 1).ok).toBe(true)
  })
})

describe('clientIp', () => {
  it('takes the first hop from x-forwarded-for', () => {
    const req = new Request('https://x.test', {
      headers: { 'x-forwarded-for': '203.0.113.1, 10.0.0.1' },
    })
    expect(clientIp(req)).toBe('203.0.113.1')
  })

  it('falls back to x-real-ip then unknown', () => {
    expect(clientIp(new Request('https://x.test', { headers: { 'x-real-ip': '198.51.100.7' } }))).toBe(
      '198.51.100.7'
    )
    expect(clientIp(new Request('https://x.test'))).toBe('unknown')
  })
})
