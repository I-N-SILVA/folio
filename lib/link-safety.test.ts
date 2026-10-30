import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('server-only', () => ({}))

import {
  collectOutboundLinks,
  findUnsafeLinks,
  clearLinkSafetyCache,
  unsafeLinkResponse,
} from './link-safety'
import type { Page } from './book-schema'

const page = (p: Partial<Page>): Pick<Page, 'blocks' | 'hotspots'> =>
  ({ blocks: [], hotspots: [], ...p }) as Pick<Page, 'blocks' | 'hotspots'>

describe('collectOutboundLinks', () => {
  it('finds every place a reader can be sent', () => {
    const links = collectOutboundLinks([
      page({
        hotspots: [
          { id: 'h', label: 'x', x: 1, y: 1, action: 'link', linkUrl: 'https://a.example/1' },
          {
            id: 'h2',
            label: 'y',
            x: 1,
            y: 1,
            action: 'checkout',
            stripeUrl: 'https://pay.example/2',
          },
        ] as Page['hotspots'],
        blocks: [
          { type: 'button', id: 'b', label: 'Go', href: 'https://b.example/3' },
          {
            type: 'product-grid',
            id: 'g',
            items: [
              { id: 'i', name: 'Coat', price: '$1', image: '', buyUrl: 'https://shop.example/4' },
            ],
          },
          { type: 'text', id: 't', content: 'See https://c.example/5 and https://c.example/5.' },
          {
            type: 'embed',
            id: 'e',
            html: '<iframe src="https://d.example/6"></iframe>',
            height: 300,
          },
        ] as unknown as Page['blocks'],
      }),
    ])
    expect(links).toEqual(
      expect.arrayContaining([
        'https://a.example/1',
        'https://pay.example/2',
        'https://b.example/3',
        'https://shop.example/4',
        'https://d.example/6',
      ])
    )
    // Deduplicated, and the trailing full stop is not part of the link.
    expect(links.filter((l) => l.startsWith('https://c.example/5'))).toHaveLength(1)
  })

  it('ignores mailto, tel and empty drafts — they send no one to a website', () => {
    const links = collectOutboundLinks([
      page({
        blocks: [
          { type: 'button', id: 'b1', label: 'Mail', href: 'mailto:me@example.com' },
          { type: 'button', id: 'b2', label: 'Call', href: 'tel:+15555555' },
          { type: 'button', id: 'b3', label: 'Draft', href: '' },
        ] as unknown as Page['blocks'],
      }),
    ])
    expect(links).toEqual([])
  })
})

describe('findUnsafeLinks', () => {
  const original = globalThis.fetch

  beforeEach(() => {
    clearLinkSafetyCache()
    process.env.GOOGLE_WEB_RISK_API_KEY = 'test-key'
  })
  afterEach(() => {
    globalThis.fetch = original
    delete process.env.GOOGLE_WEB_RISK_API_KEY
  })

  it('reports what Web Risk lists, and passes what it does not', async () => {
    globalThis.fetch = vi.fn(async (input: RequestInfo | URL) => {
      const uri = new URL(String(input)).searchParams.get('uri')
      const body =
        uri === 'https://evil.example/login'
          ? { threat: { threatTypes: ['SOCIAL_ENGINEERING'] } }
          : {}
      return new Response(JSON.stringify(body), { status: 200 })
    }) as typeof fetch

    const unsafe = await findUnsafeLinks(['https://good.example', 'https://evil.example/login'])
    expect(unsafe).toEqual([{ url: 'https://evil.example/login', threats: ['SOCIAL_ENGINEERING'] }])
  })

  it('asks once per link per day, so an autosaving editor does not spend a lookup a keystroke', async () => {
    const fetchSpy = vi.fn(async () => new Response('{}', { status: 200 }))
    globalThis.fetch = fetchSpy as typeof fetch
    await findUnsafeLinks(['https://good.example'])
    await findUnsafeLinks(['https://good.example'])
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('fails open: an outage at Google blocks nobody', async () => {
    globalThis.fetch = vi.fn(async () => new Response('boom', { status: 503 })) as typeof fetch
    expect(await findUnsafeLinks(['https://anything.example'])).toEqual([])
    globalThis.fetch = vi.fn(async () => {
      throw new Error('network')
    }) as typeof fetch
    expect(await findUnsafeLinks(['https://other.example'])).toEqual([])
  })

  it('checks nothing without a key', async () => {
    delete process.env.GOOGLE_WEB_RISK_API_KEY
    const fetchSpy = vi.fn()
    globalThis.fetch = fetchSpy as typeof fetch
    expect(await findUnsafeLinks(['https://evil.example'])).toEqual([])
    expect(fetchSpy).not.toHaveBeenCalled()
  })

  it('tells the author which link to remove', () => {
    const body = unsafeLinkResponse([{ url: 'https://evil.example/login', threats: ['MALWARE'] }])
    expect(body.code).toBe('unsafe_link')
    expect(body.error).toContain('https://evil.example/login')
  })
})
