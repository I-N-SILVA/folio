import 'server-only'
import { lookup } from 'node:dns/promises'

// ─── Guarding a fetch of an author-supplied URL ──────────────────────────────
//
// A Next.js route file may only export route handlers, so these live here — and
// they belong in a shared module anyway: any future feature that fetches a URL
// an author typed needs exactly this check.

/**
 * Whether the server is willing to fetch this image.
 *
 * `page.background.image` is author-supplied and fetched server-side, so an
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

export async function isFetchableImage(url: string): Promise<boolean> {
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
