import { describe, it, expect, beforeEach } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import vm from 'node:vm'

/**
 * The service worker outlives the deploy that installed it, so "which requests
 * does it touch" is worth asserting rather than reading. This loads the real
 * public/sw.js into a sandbox, grabs its fetch listener, and checks whether it
 * claims a given request (respondWith) or leaves it to the network.
 */

type FakeRequest = {
  method: string
  url: string
  mode?: string
  destination?: string
  headers: { has: (name: string) => boolean }
}

function makeRequest(url: string, opts: Partial<Omit<FakeRequest, 'headers'>> & { range?: boolean } = {}) {
  return {
    method: opts.method ?? 'GET',
    url,
    mode: opts.mode ?? 'no-cors',
    destination: opts.destination ?? '',
    headers: { has: (n: string) => n.toLowerCase() === 'range' && !!opts.range },
  } as FakeRequest
}

let fetchHandler: (event: unknown) => void

beforeEach(() => {
  const source = readFileSync(join(process.cwd(), 'public/sw.js'), 'utf8')
  const listeners: Record<string, (event: unknown) => void> = {}

  const noopCache = {
    open: async () => ({ addAll: async () => {}, keys: async () => [], put: async () => {}, delete: async () => {} }),
    keys: async () => [],
    delete: async () => {},
    match: async () => undefined,
  }

  const self = {
    addEventListener: (type: string, fn: (event: unknown) => void) => {
      listeners[type] = fn
    },
    location: { origin: 'https://qlico.test' },
    skipWaiting: () => {},
    clients: { claim: () => {} },
  }

  const sandbox = { self, caches: noopCache, URL, fetch: async () => ({ ok: true, status: 200, type: 'basic', clone: () => ({}) }), Promise, console }
  vm.createContext(sandbox)
  vm.runInContext(source, sandbox)

  fetchHandler = listeners.fetch
})

/** True when the worker takes over the request. */
function claimed(request: FakeRequest): boolean {
  let didRespond = false
  fetchHandler({ request, respondWith: () => { didRespond = true } })
  return didRespond
}

describe('service worker request handling', () => {
  it('handles navigations so offline has a fallback', () => {
    expect(claimed(makeRequest('https://qlico.test/', { mode: 'navigate' }))).toBe(true)
    expect(claimed(makeRequest('https://qlico.test/book/my-edition', { mode: 'navigate' }))).toBe(true)
  })

  it('caches hashed build assets', () => {
    expect(claimed(makeRequest('https://qlico.test/_next/static/chunks/abc123.js'))).toBe(true)
  })

  it('caches public images, fonts and stylesheets', () => {
    expect(claimed(makeRequest('https://qlico.test/icon.png', { destination: 'image' }))).toBe(true)
    expect(claimed(makeRequest('https://qlico.test/f.woff2', { destination: 'font' }))).toBe(true)
  })

  // ── The regressions the allowlist exists to prevent ───────────────────────

  it('never touches RSC payloads', () => {
    // Stale here means a book the author just created is missing from the
    // dashboard, and these payloads are private.
    expect(claimed(makeRequest('https://qlico.test/dashboard?_rsc=1a2b3c'))).toBe(false)
    expect(claimed(makeRequest('https://qlico.test/?_rsc=1a2b3c'))).toBe(false)
    expect(
      claimed(makeRequest('https://qlico.test/dashboard?_rsc=1a2b3c', { mode: 'navigate' }))
    ).toBe(false)
  })

  it('never caches signed-in surfaces', () => {
    for (const path of ['/dashboard', '/editor/abc', '/account', '/analytics/my-book', '/create', '/redeem']) {
      expect(claimed(makeRequest(`https://qlico.test${path}`, { mode: 'navigate' })), path).toBe(false)
    }
  })

  it('leaves range requests to the network so media can seek', () => {
    expect(
      claimed(makeRequest('https://qlico.test/audio.mp3', { destination: 'audio', range: true }))
    ).toBe(false)
  })

  it('leaves audio and video alone even without a range header', () => {
    expect(claimed(makeRequest('https://qlico.test/a.mp3', { destination: 'audio' }))).toBe(false)
    expect(claimed(makeRequest('https://qlico.test/v.mp4', { destination: 'video' }))).toBe(false)
  })

  it('ignores API, auth and embed routes', () => {
    expect(claimed(makeRequest('https://qlico.test/api/books'))).toBe(false)
    expect(claimed(makeRequest('https://qlico.test/auth/callback', { mode: 'navigate' }))).toBe(false)
    expect(claimed(makeRequest('https://qlico.test/embed/my-book', { mode: 'navigate' }))).toBe(false)
  })

  it('ignores non-GET and cross-origin requests', () => {
    expect(claimed(makeRequest('https://qlico.test/icon.png', { method: 'POST', destination: 'image' }))).toBe(false)
    expect(claimed(makeRequest('https://cdn.other.test/x.png', { destination: 'image' }))).toBe(false)
  })

  it('does not treat a lookalike path as private', () => {
    // /createx is not /create — a prefix test without the boundary check would
    // have excluded it, and it would silently stop being cached.
    expect(claimed(makeRequest('https://qlico.test/press', { mode: 'navigate' }))).toBe(true)
  })
})
