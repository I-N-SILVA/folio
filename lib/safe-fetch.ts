import 'server-only'
import { lookup } from 'node:dns/promises'

// ─── Guarding a fetch of an author-supplied URL ──────────────────────────────
//
// A Next.js route file may only export route handlers, so these live here — and
// they belong in a shared module anyway: any future feature that fetches a URL
// an author typed needs exactly this check.

/**
 * Whether the server is willing to fetch this URL on someone else's behalf.
 *
 * A page background image and a live-data source are both author-supplied and
 * fetched server-side, so an
 * unguarded fetch is a request the server makes on someone else's behalf to
 * anywhere it can reach — including the metadata endpoints and private ranges a
 * browser could never touch.
 *
 * A lexical hostname blocklist is not enough on its own, and two bypasses are
 * why this resolves the name instead:
 *
 *   - `http://127.0.0.1.nip.io/` is a public name that resolves to loopback. It
 *     passes any regex written against the hostname string.
 *   - `fetch` follows redirects by default and only the first URL is ever
 *     checked, so `https://attacker.example/x.png` answering `302 →
 *     http://169.254.169.254/…` walks straight through. The fetch below uses
 *     `redirect: 'manual'` for that reason; a redirect is simply not followed.
 *
 * WHATWG URL parsing does the rest of the work: `http://2130706433/`,
 * `http://0x7f000001/` and `http://0177.0.0.1/` all normalise to `127.0.0.1`
 * before this sees them.
 */
export function isPrivateAddress(ip: string): boolean {
  if (ip.includes(':')) {
    const v6 = ip.toLowerCase()
    // loopback, unspecified, unique-local (fc00::/7) and link-local (fe80::/10)
    if (v6 === '::1' || v6 === '::') return true
    if (/^f[cd]/.test(v6) || /^fe[89ab]/.test(v6)) return true
    // IPv4-mapped, e.g. ::ffff:127.0.0.1
    const mapped = v6.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/)
    return mapped ? isPrivateAddress(mapped[1]) : false
  }

  const [a, b] = ip.split('.').map(Number)
  if (Number.isNaN(a) || Number.isNaN(b)) return true // unparseable: refuse
  if (a === 0 || a === 10 || a === 127) return true
  if (a === 169 && b === 254) return true // link-local, incl. cloud metadata
  if (a === 172 && b >= 16 && b <= 31) return true
  if (a === 192 && b === 168) return true
  if (a === 100 && b >= 64 && b <= 127) return true // CGNAT, incl. 100.100.100.200
  if (a >= 224) return true // multicast and reserved
  return false
}

export async function isFetchableUrl(url: string): Promise<boolean> {
  let parsed: URL
  try {
    parsed = new URL(url)
  } catch {
    return false
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return false

  const host = parsed.hostname.toLowerCase().replace(/^\[|\]$/g, '')
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.internal')) {
    return false
  }
  if (host === 'metadata.google.internal') return false

  // A literal address needs no lookup; a name does, because a public name is
  // free to point at a private address.
  if (/^[0-9.]+$/.test(host) || host.includes(':')) return !isPrivateAddress(host)

  try {
    const { address } = await lookup(host)
    return !isPrivateAddress(address)
  } catch {
    return false
  }
}

/** Refused before any request left the process. */
export class BlockedUrlError extends Error {
  constructor(readonly url: string) {
    super(`Refused to fetch ${url}`)
    this.name = 'BlockedUrlError'
  }
}

/**
 * `fetch`, with every hop checked.
 *
 * `redirect: 'manual'` is what keeps a redirect from walking past the guard, but
 * on its own it also breaks the honest majority: an author's data source behind
 * `http → https`, a shortened link, or a Google Sheets publish URL is a redirect,
 * and refusing all of them means the feature only works for sources that happen
 * to answer directly. So follow them — one at a time, re-checking each hop the
 * same way the first URL was checked. That is the only difference between this
 * and `fetch`, and it is the whole point.
 *
 * Throws `BlockedUrlError` when a hop is refused, so a caller can tell "this URL
 * is not allowed" from "the source is down".
 */
export async function safeFetch(
  url: string,
  init: RequestInit & { maxRedirects?: number } = {}
): Promise<Response> {
  const { maxRedirects = 3, ...rest } = init
  let current = url

  for (let hop = 0; hop <= maxRedirects; hop++) {
    if (!(await isFetchableUrl(current))) throw new BlockedUrlError(current)

    const res = await fetch(current, { ...rest, redirect: 'manual' })
    if (res.status < 300 || res.status > 399) return res

    const location = res.headers.get('location')
    if (!location) return res
    try {
      current = new URL(location, current).toString()
    } catch {
      throw new BlockedUrlError(location)
    }
  }

  throw new BlockedUrlError(`${url} (too many redirects)`)
}
