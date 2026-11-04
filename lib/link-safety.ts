import 'server-only'
import type { Page } from '@/lib/book-schema'

// ─── Outbound-link safety ────────────────────────────────────────────────────
//
// Every link an edition sends a reader to — buttons, hotspots, product "buy"
// links, URLs in text and embeds — checked against Google's Web Risk list of
// phishing, malware and unwanted-software sites. An edition linking to one is
// how this product gets used to phish people, and how its domain ends up on
// the same list.
//
// Web Risk rather than the Safe Browsing Lookup API: Safe Browsing is licensed
// for non-commercial use only. Web Risk's first 100,000 lookups a month are
// free, and results are cached here for a day, so an autosaving editor does
// not spend one per keystroke.
//
// Optional and fails open. Without `GOOGLE_WEB_RISK_API_KEY`, or when the API
// is unreachable, nothing is blocked: an outage at Google must not stop every
// author from publishing. The suspension switch (023) is the backstop.

const ENDPOINT = 'https://webrisk.googleapis.com/v1/uris:search'
const THREATS = ['MALWARE', 'SOCIAL_ENGINEERING', 'UNWANTED_SOFTWARE']
const CACHE_MS = 24 * 60 * 60 * 1000
/** An edition with more links than this has the first ones checked. */
const MAX_LINKS = 100
const CONCURRENCY = 5

export function isLinkCheckEnabled(): boolean {
  return Boolean(process.env.GOOGLE_WEB_RISK_API_KEY)
}

const URL_IN_TEXT = /https?:\/\/[^\s"'<>)\]]+/g

/** Every http(s) link a reader could be sent to from these pages, deduplicated. */
export function collectOutboundLinks(pages: Pick<Page, 'blocks' | 'hotspots'>[]): string[] {
  const found = new Set<string>()
  const add = (u: unknown) => {
    if (typeof u !== 'string') return
    // A URL in prose usually ends a sentence; the full stop is not the link's.
    const s = u.trim().replace(/[.,;:!?]+$/, '')
    if (/^https?:\/\//i.test(s)) found.add(s)
  }

  for (const page of pages) {
    for (const h of page.hotspots ?? []) {
      add(h.linkUrl)
      add(h.stripeUrl)
    }
    for (const block of page.blocks ?? []) {
      switch (block.type) {
        case 'button':
          add(block.href)
          break
        case 'product-grid':
          for (const item of block.items ?? []) add(item.buyUrl)
          break
        case 'text':
          for (const m of block.content.match(URL_IN_TEXT) ?? []) add(m)
          break
        case 'embed':
          for (const m of block.html.match(URL_IN_TEXT) ?? []) add(m)
          break
      }
    }
  }
  return [...found].slice(0, MAX_LINKS)
}

type Verdict = { unsafe: boolean; threats: string[]; at: number }
const cache = new Map<string, Verdict>()

async function lookup(url: string, key: string): Promise<Verdict | null> {
  const hit = cache.get(url)
  if (hit && Date.now() - hit.at < CACHE_MS) return hit

  const qs = new URLSearchParams({ uri: url, key })
  for (const t of THREATS) qs.append('threatTypes', t)

  try {
    const res = await fetch(`${ENDPOINT}?${qs}`, { signal: AbortSignal.timeout(4_000) })
    if (!res.ok) return null
    const body = (await res.json()) as { threat?: { threatTypes?: string[] } }
    const threats = body.threat?.threatTypes ?? []
    const verdict = { unsafe: threats.length > 0, threats, at: Date.now() }
    cache.set(url, verdict)
    if (cache.size > 10_000) cache.delete(cache.keys().next().value as string)
    return verdict
  } catch {
    return null
  }
}

export type UnsafeLink = { url: string; threats: string[] }

/** The links Web Risk lists as dangerous. Empty when checking is off or unavailable. */
export async function findUnsafeLinks(urls: string[]): Promise<UnsafeLink[]> {
  const key = process.env.GOOGLE_WEB_RISK_API_KEY
  if (!key || urls.length === 0) return []

  const unsafe: UnsafeLink[] = []
  for (let i = 0; i < urls.length; i += CONCURRENCY) {
    const verdicts = await Promise.all(urls.slice(i, i + CONCURRENCY).map((u) => lookup(u, key)))
    verdicts.forEach((v, j) => {
      if (v?.unsafe) unsafe.push({ url: urls[i + j], threats: v.threats })
    })
  }
  return unsafe
}

/** For tests. */
export function clearLinkSafetyCache(): void {
  cache.clear()
}

/** The 422 body for a save or publish refused over dangerous links. */
export function unsafeLinkResponse(unsafe: UnsafeLink[]) {
  const shown = unsafe.slice(0, 3).map((u) => u.url)
  return {
    error:
      `This edition links to ${unsafe.length === 1 ? 'a site' : `${unsafe.length} sites`} ` +
      `listed as dangerous (phishing or malware): ${shown.join(', ')}` +
      `${unsafe.length > shown.length ? ', …' : ''}. Remove ${unsafe.length === 1 ? 'it' : 'them'} to save. ` +
      'If you think this is wrong, contact support.',
    code: 'unsafe_link',
    links: unsafe,
  }
}
