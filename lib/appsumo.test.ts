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
