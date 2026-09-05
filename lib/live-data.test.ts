import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { getPath, resolveSource, probeLiveValue, readLiveValue, clearLiveDataCache } from '@/lib/live-data'

/**
 * These tests exist because the failure this module was written to fix was
 * invisible to every other check in the repo: the Data block fetched its source
 * from the reader's browser, so CORS decided whether the feature worked, and the
 * author's own Test button had the same blind spot. Typecheck, lint and the
 * whole suite were green while the block read "Offline" for every reader.
 *
 * So what is asserted here is behaviour at the seams — what happens when a
 * source is slow, gone, redirecting, private, or answering with something that
 * is not JSON — rather than the happy path, which was never the problem.
 */

const ORIGINAL_FETCH = globalThis.fetch

/** A response, without pulling in a fetch mock library. */
function res(body: unknown, init: { status?: number; headers?: Record<string, string> } = {}): Response {
  return new Response(typeof body === 'string' ? body : JSON.stringify(body), {
    status: init.status ?? 200,
    headers: init.headers,
  })
}

beforeEach(() => {
  clearLiveDataCache()
  vi.useRealTimers()
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  vi.restoreAllMocks()
  vi.useRealTimers()
})

describe('getPath', () => {
  it('walks a dot path, including array indexes', () => {
    const json = { product: { price: 42 }, items: [{ total: 9 }] }
    expect(getPath(json, 'product.price')).toBe(42)
    expect(getPath(json, 'items.0.total')).toBe(9)
  })

  it('returns undefined rather than throwing on a missing branch', () => {
    expect(getPath({ a: 1 }, 'a.b.c')).toBeUndefined()
    expect(getPath(null, 'a')).toBeUndefined()
  })
})

describe('resolveSource', () => {
  it('resolves a same-origin path against the configured site, not a Host header', () => {
    // The demo editions ship `/demo-live.json`. Resolving that against the
    // request origin would let a forged Host make the server fetch anywhere.
    expect(resolveSource('/demo-live.json')).toBe('https://qlico.app/demo-live.json')
  })

  it('leaves an absolute URL alone', () => {
    expect(resolveSource('https://api.example.com/v1/stats')).toBe('https://api.example.com/v1/stats')
  })

  it('has nothing to resolve for an empty source', () => {
    expect(resolveSource('')).toBeNull()
  })
})

describe('probeLiveValue', () => {
  it('reads the value at the path', async () => {
    globalThis.fetch = vi.fn(async () => res({ product: { price: '129.00' } })) as unknown as typeof fetch
    await expect(probeLiveValue('https://example.com/d.json', 'product.price')).resolves.toEqual({
      ok: true,
      value: '129.00',
    })
  })

  it('coerces a number so the block renders it', async () => {
    globalThis.fetch = vi.fn(async () => res({ n: 7 })) as unknown as typeof fetch
    const probe = await probeLiveValue('https://example.com/d.json', 'n')
    expect(probe).toEqual({ ok: true, value: '7' })
  })

  it('distinguishes a missing path from an unreachable source', async () => {
    // The whole point of the studio's Test button: "your path is wrong" and
    // "your source is down" used to produce the same sentence.
    globalThis.fetch = vi.fn(async () => res({ product: {} })) as unknown as typeof fetch
    const missing = await probeLiveValue('https://example.com/d.json', 'product.price')
    expect(missing).toMatchObject({ ok: false, reason: 'path-missing' })

    globalThis.fetch = vi.fn(async () => {
      throw new Error('ECONNREFUSED')
    }) as unknown as typeof fetch
    const down = await probeLiveValue('https://example.com/d.json', 'product.price')
    expect(down).toMatchObject({ ok: false, reason: 'unreachable' })
  })

  it('reports an HTTP error with its status', async () => {
    globalThis.fetch = vi.fn(async () => res('nope', { status: 404 })) as unknown as typeof fetch
    const probe = await probeLiveValue('https://example.com/d.json', 'a')
    expect(probe).toMatchObject({ ok: false, reason: 'http-error' })
    expect(probe.ok === false && probe.detail).toContain('404')
  })

  it('reports a source that answers with HTML rather than crashing', async () => {
    // A login wall or an error page is the most common thing a wrong URL
    // returns, and `res.json()` throwing there used to look like "unreachable".
    globalThis.fetch = vi.fn(async () => res('<!doctype html><title>Sign in</title>')) as unknown as typeof fetch
    expect(await probeLiveValue('https://example.com/d.json', 'a')).toMatchObject({
      ok: false,
      reason: 'not-json',
    })
  })

  it('refuses a private address', async () => {
    const fetchSpy = vi.fn(async () => res({ a: 1 }))
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    expect(await probeLiveValue('http://169.254.169.254/latest/meta-data/', 'a')).toMatchObject({
      ok: false,
      reason: 'blocked',
    })
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('refuses a public name that redirects to a private one', async () => {
    // The bypass that makes `redirect: "manual"` non-negotiable: only the first
    // URL is ever checked by a lexical guard, so the second hop is free.
    const fetchSpy = vi.fn(async (url: string) => {
      if (String(url).includes('example.com')) {
        return res('', { status: 302, headers: { location: 'http://169.254.169.254/latest/meta-data/' } })
      }
      return res({ secret: 'leaked' })
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    expect(await probeLiveValue('https://example.com/redirect', 'secret')).toMatchObject({
      ok: false,
      reason: 'blocked',
    })
    // It followed the first hop and stopped: the metadata endpoint was never hit.
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('follows an ordinary redirect, because most real sources have one', async () => {
    const fetchSpy = vi.fn(async (url: string) => {
      if (String(url).endsWith('/short')) {
        return res('', { status: 301, headers: { location: 'https://example.com/final.json' } })
      }
      return res({ n: 1 })
    })
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    expect(await probeLiveValue('https://example.com/short', 'n')).toEqual({ ok: true, value: '1' })
  })

  it('gives up on a redirect loop instead of following it forever', async () => {
    globalThis.fetch = vi.fn(async () =>
      res('', { status: 302, headers: { location: 'https://example.com/loop' } })
    ) as unknown as typeof fetch
    expect(await probeLiveValue('https://example.com/loop', 'n')).toMatchObject({
      ok: false,
      reason: 'blocked',
    })
  })
})

describe('readLiveValue', () => {
  it('serves the second reader from cache rather than the source', async () => {
    // One cache entry per source serves every reader. Without it, load on the
    // author's source scales with how many people have the edition open.
    const fetchSpy = vi.fn(async () => res({ n: 1 }))
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    await readLiveValue('https://example.com/d.json', 'n')
    const second = await readLiveValue('https://example.com/d.json', 'n')

    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect(second).toMatchObject({ value: '1', stale: false })
  })

  it('keys the cache by source and path together', async () => {
    const fetchSpy = vi.fn(async () => res({ a: 1, b: 2 }))
    globalThis.fetch = fetchSpy as unknown as typeof fetch

    expect(await readLiveValue('https://example.com/d.json', 'a')).toMatchObject({ value: '1' })
    expect(await readLiveValue('https://example.com/d.json', 'b')).toMatchObject({ value: '2' })
  })

  it('falls back to the last good value, marked stale, when the source goes down', async () => {
    vi.useFakeTimers()
    globalThis.fetch = vi.fn(async () => res({ n: '42' })) as unknown as typeof fetch
    expect(await readLiveValue('https://example.com/d.json', 'n')).toMatchObject({ value: '42', stale: false })

    // Past the 30s TTL, so the next read actually asks the source.
    vi.advanceTimersByTime(60_000)
    globalThis.fetch = vi.fn(async () => {
      throw new Error('down')
    }) as unknown as typeof fetch

    // An hour-old figure is worth far more to a reader than "Offline".
    expect(await readLiveValue('https://example.com/d.json', 'n')).toEqual({
      value: '42',
      fetchedAt: expect.any(String),
      stale: true,
    })
  })

  it('stops serving a stale value once it is older than the grace window', async () => {
    vi.useFakeTimers()
    globalThis.fetch = vi.fn(async () => res({ n: '42' })) as unknown as typeof fetch
    await readLiveValue('https://example.com/d.json', 'n')

    // Seven hours: a number from this morning presented as current is worse
    // than an honest gap.
    vi.advanceTimersByTime(7 * 60 * 60 * 1000)
    globalThis.fetch = vi.fn(async () => {
      throw new Error('down')
    }) as unknown as typeof fetch

    expect(await readLiveValue('https://example.com/d.json', 'n')).toMatchObject({ value: null, stale: true })
  })

  it('reports a missing path as a fresh read, not as staleness', async () => {
    // The source answered. This is a typo in the author's path, and dressing it
    // up as "stale" would send them looking at their API.
    globalThis.fetch = vi.fn(async () => res({ other: 1 })) as unknown as typeof fetch
    expect(await readLiveValue('https://example.com/d.json', 'n')).toMatchObject({
      value: null,
      stale: false,
    })
  })

  it('does not re-ask the source for a path that is not there', async () => {
    const fetchSpy = vi.fn(async () => res({ other: 1 }))
    globalThis.fetch = fetchSpy as unknown as typeof fetch
    await readLiveValue('https://example.com/d.json', 'n')
    await readLiveValue('https://example.com/d.json', 'n')
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })
})
