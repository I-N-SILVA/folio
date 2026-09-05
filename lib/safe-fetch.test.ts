import { describe, it, expect } from 'vitest'
import { isPrivateAddress, isFetchableUrl } from '@/lib/safe-fetch'

describe('isPrivateAddress', () => {
  it('refuses loopback, link-local and the private ranges', () => {
    for (const ip of ['127.0.0.1', '10.1.2.3', '192.168.0.1', '172.16.0.1', '172.31.255.255']) {
      expect(isPrivateAddress(ip)).toBe(true)
    }
  })

  it('refuses cloud metadata addresses', () => {
    // AWS/GCP/Azure link-local, and Alibaba's on the CGNAT range.
    expect(isPrivateAddress('169.254.169.254')).toBe(true)
    expect(isPrivateAddress('100.100.100.200')).toBe(true)
  })

  it('refuses 0.0.0.0, multicast and reserved space', () => {
    expect(isPrivateAddress('0.0.0.0')).toBe(true)
    expect(isPrivateAddress('224.0.0.1')).toBe(true)
    expect(isPrivateAddress('255.255.255.255')).toBe(true)
  })

  it('refuses IPv6 loopback, unique-local and link-local', () => {
    for (const ip of ['::1', 'fc00::1', 'fd12:3456::1', 'fe80::1']) {
      expect(isPrivateAddress(ip)).toBe(true)
    }
  })

  it('sees through an IPv4-mapped IPv6 address', () => {
    expect(isPrivateAddress('::ffff:127.0.0.1')).toBe(true)
    expect(isPrivateAddress('::ffff:8.8.8.8')).toBe(false)
  })

  it('refuses anything it cannot parse rather than letting it through', () => {
    expect(isPrivateAddress('not-an-address')).toBe(true)
  })

  it('allows ordinary public addresses', () => {
    for (const ip of ['8.8.8.8', '1.1.1.1', '172.15.0.1', '172.32.0.1', '2606:4700::1111']) {
      expect(isPrivateAddress(ip)).toBe(false)
    }
  })
})

describe('isFetchableUrl', () => {
  it('refuses every scheme but http and https', async () => {
    for (const url of ['file:///etc/passwd', 'gopher://x/', 'data:image/png;base64,AAAA']) {
      expect(await isFetchableUrl(url)).toBe(false)
    }
  })

  it('refuses a literal private address whatever the encoding', async () => {
    // WHATWG parsing normalises all of these to 127.0.0.1 before we see them.
    for (const host of ['127.0.0.1', '2130706433', '0x7f000001', '0177.0.0.1']) {
      expect(await isFetchableUrl(`http://${host}/x.png`)).toBe(false)
    }
    expect(await isFetchableUrl('http://169.254.169.254/latest/meta-data/')).toBe(false)
    expect(await isFetchableUrl('http://[::1]/x.png')).toBe(false)
  })

  it('refuses localhost and internal names', async () => {
    for (const host of [
      'localhost',
      'db.localhost',
      'redis.internal',
      'metadata.google.internal',
    ]) {
      expect(await isFetchableUrl(`http://${host}/x.png`)).toBe(false)
    }
  })

  /**
   * The one case that needs the network, and the reason the guard resolves
   * names at all: nip.io answers with the address embedded in the name, so
   * `127.0.0.1.nip.io` is a genuine public DNS record pointing at loopback and
   * passes any check written against the hostname string.
   *
   * The public assertion comes first on purpose. If DNS is unavailable the
   * guard refuses everything, and without it this test would pass for entirely
   * the wrong reason.
   */
  it('resolves names, so a public name pointing at a private address is refused', async () => {
    expect(await isFetchableUrl('https://example.com/x.png')).toBe(true)
    expect(await isFetchableUrl('http://127.0.0.1.nip.io/x.png')).toBe(false)
  })
})
