import 'server-only'
import { safeFetch, BlockedUrlError } from './safe-fetch'

/**
 * Reading one value out of an author's JSON source, on the server.
 *
 * The Data block used to fetch straight from the reader's browser, which meant
 * three things nobody would want:
 *
 *   - **CORS decided whether the feature worked.** Most real sources — an API,
 *     a Sheet, anything not on qlico.app — send no `Access-Control-Allow-Origin`
 *     for a reader's origin, so the block showed "Offline" to every reader while
 *     testing fine for the author, whose own Test button had the same problem
 *     and so usually got tried against a same-origin path.
 *   - **The source URL shipped inside the published page**, so anything with a
 *     token in the query string was public.
 *   - **Load scaled with readers.** Every open tab re-polled the author's source
 *     every 45 seconds, forever.
 *
 * Fetching here fixes all three: no CORS on a server request, the URL never
 * leaves the server, and one cache entry serves every reader.
 */

export interface LiveValue {
  value: string | null
  /** When the value was actually read from the source. */
  fetchedAt: string
  /** True when the source could not be reached and this is the last good value. */
  stale: boolean
}

/** Why a read failed, in terms an author can act on. */
export type ProbeFailure = 'blocked' | 'unreachable' | 'http-error' | 'not-json' | 'path-missing'

export type Probe = { ok: true; value: string } | { ok: false; reason: ProbeFailure; detail: string }

/** How long a value is reused before the source is asked again. */
const TTL_MS = 30_000

/**
 * How long a last-good value survives once the source starts failing.
 *
 * A source that goes down should degrade to yesterday's number rather than to
 * "Offline" — a figure that is an hour old is far more useful to a reader than
 * no figure. After this it gives up and says so, because a number from last
 * week presented as current is worse than an honest gap.
 */
const STALE_GRACE_MS = 6 * 60 * 60 * 1000

const FETCH_TIMEOUT_MS = 6_000

/** A source answering with a whole database should not become a cache entry. */
const MAX_BODY_BYTES = 512 * 1024

/** Bounds the cache on a long-lived instance. */
const MAX_ENTRIES = 500

interface Entry {
  value: string | null
  fetchedAt: number
  /** Last time a fetch actually succeeded, for the grace window. */
  okAt: number
}

const cache = new Map<string, Entry>()

/** Walks a dot path, e.g. `product.price` or `items.0.total`. */
export function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

/**
 * The demo editions ship sources like `/demo-live.json`, and an author who
 * uploads a JSON file to their own edition gets a path too. A path has no host
 * to resolve, so it is resolved against an origin *we* choose — never against a
 * `Host` header, which a caller controls and which would turn every relative
 * source into a request to wherever they liked.
 */
export function resolveSource(source: string): string | null {
  if (!source) return null
  if (!source.startsWith('/')) return source
  try {
    return new URL(source, process.env.NEXT_PUBLIC_SITE_URL || 'https://qlico.app').toString()
  } catch {
    return null
  }
}

function evict() {
  if (cache.size <= MAX_ENTRIES) return
  // Oldest first. Map preserves insertion order, and every write re-inserts.
  const excess = cache.size - MAX_ENTRIES
  let i = 0
  for (const key of cache.keys()) {
    if (i++ >= excess) break
    cache.delete(key)
  }
}

export function clearLiveDataCache() {
  cache.clear()
}

/**
 * One uncached read, with the reason it failed.
 *
 * This is what the studio's Test button runs, so the author gets "that path is
 * not in the response" rather than the old catch-all "could not fetch or parse
 * the source" — which covered a CORS refusal, a 404, a redirect and a typo in
 * the path identically, and left no way to tell which one you had.
 */
export async function probeLiveValue(source: string, path: string): Promise<Probe> {
  const url = resolveSource(source)
  if (!url) return { ok: false, reason: 'blocked', detail: 'That does not look like a URL.' }

  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)

  try {
    const res = await safeFetch(url, {
      cache: 'no-store',
      signal: controller.signal,
      headers: { accept: 'application/json' },
    })
    if (!res.ok) return { ok: false, reason: 'http-error', detail: `The source answered ${res.status}.` }

    if (Number(res.headers.get('content-length') ?? 0) > MAX_BODY_BYTES) {
      return { ok: false, reason: 'not-json', detail: 'That response is too large to read.' }
    }

    const text = (await res.text()).slice(0, MAX_BODY_BYTES)
    let json: unknown
    try {
      json = JSON.parse(text)
    } catch {
      return { ok: false, reason: 'not-json', detail: 'The source did not return JSON.' }
    }

    const raw = getPath(json, path)
    if (raw == null || typeof raw === 'object') {
      return { ok: false, reason: 'path-missing', detail: `"${path}" is not a value in that response.` }
    }
    return { ok: true, value: String(raw) }
  } catch (err) {
    if (err instanceof BlockedUrlError) {
      return { ok: false, reason: 'blocked', detail: 'That address cannot be reached from the server.' }
    }
    return { ok: false, reason: 'unreachable', detail: 'The source did not respond.' }
  } finally {
    clearTimeout(timer)
  }
}

/**
 * The current value at `path` in the JSON at `source`, cached.
 *
 * A missing path is cached as a successful read of `null` — the source
 * answered, so this is a configuration mistake the author should see rather
 * than a transient failure to paper over, and re-asking every 30 seconds would
 * not change the answer.
 */
export async function readLiveValue(source: string, path: string): Promise<LiveValue> {
  // JSON rather than a delimiter, because any separator you pick is a character
  // a URL is allowed to contain.
  const key = JSON.stringify([source, path])
  const now = Date.now()
  const hit = cache.get(key)

  if (hit && now - hit.fetchedAt < TTL_MS) {
    return {
      value: hit.value,
      fetchedAt: new Date(hit.okAt).toISOString(),
      stale: hit.okAt !== hit.fetchedAt,
    }
  }

  const probe = await probeLiveValue(source, path)

  if (probe.ok || probe.reason === 'path-missing') {
    const value = probe.ok ? probe.value : null
    cache.set(key, { value, fetchedAt: now, okAt: now })
    evict()
    return { value, fetchedAt: new Date(now).toISOString(), stale: false }
  }

  // Within the grace window, the last good value beats an error.
  if (hit && now - hit.okAt < STALE_GRACE_MS) {
    cache.set(key, { ...hit, fetchedAt: now })
    return { value: hit.value, fetchedAt: new Date(hit.okAt).toISOString(), stale: true }
  }
  return { value: null, fetchedAt: new Date(now).toISOString(), stale: true }
}
