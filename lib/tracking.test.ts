import { describe, it, expect } from 'vitest'
import { isTrackableBook } from './tracking'

describe('isTrackableBook', () => {
  it('tracks a real edition, whose id is a database UUID', () => {
    expect(isTrackableBook('3f2504e0-4f89-11d3-9a0c-0305e82c3301')).toBe(true)
    expect(isTrackableBook(crypto.randomUUID())).toBe(true)
  })

  it('does not track the gallery, which renders templates with no rows behind them', () => {
    // Every event these fire is a request the events foreign key can only
    // reject — one wasted round trip per page turn, and a 404 in the logs for
    // every visitor reading the shop window.
    expect(isTrackableBook('gallery-fashion-lookbook')).toBe(false)
    expect(isTrackableBook('gallery-culinary-menu')).toBe(false)
  })

  it('does not track the bundled demo edition', () => {
    expect(isTrackableBook('demo-book-id')).toBe(false)
  })

  it('rejects anything that merely looks uuid-ish', () => {
    expect(isTrackableBook('')).toBe(false)
    expect(isTrackableBook('not-a-uuid')).toBe(false)
    expect(isTrackableBook('3f2504e0-4f89-11d3-9a0c')).toBe(false)
    expect(isTrackableBook('3f2504e0-4f89-11d3-9a0c-0305e82c3301-extra')).toBe(false)
  })
})

describe('the event queue', () => {
  const BOOK = '3f2504e0-4f89-11d3-9a0c-0305e82c3301'

  async function withFetch(run: (calls: unknown[][]) => Promise<void>) {
    const { vi } = await import('vitest')
    const { resetEventQueue } = await import('./tracking')
    resetEventQueue()
    const calls: unknown[][] = []
    const original = globalThis.fetch
    globalThis.fetch = vi.fn(async (...args: unknown[]) => {
      calls.push(args)
      return new Response(null, { status: 204 })
    }) as typeof fetch
    try {
      await run(calls)
    } finally {
      globalThis.fetch = original
      resetEventQueue()
    }
  }

  it('sends a page turn as one request, not one per event', async () => {
    const { vi } = await import('vitest')
    const { trackEvent } = await import('./tracking')
    vi.useFakeTimers()
    try {
      await withFetch(async (calls) => {
        await trackEvent(BOOK, 'page_view', { page_number: 1, dwell_ms: 900 })
        await trackEvent(BOOK, 'page_flip', { from_page: 1, to_page: 2 })
        expect(calls).toHaveLength(0)

        vi.advanceTimersByTime(2_000)
        expect(calls).toHaveLength(1)
        const body = JSON.parse((calls[0][1] as RequestInit).body as string)
        expect(body.events.map((e: { eventType: string }) => e.eventType)).toEqual([
          'page_view',
          'page_flip',
        ])
      })
    } finally {
      vi.useRealTimers()
    }
  })

  it('sends at once when the batch fills, without waiting for the timer', async () => {
    const { trackEvent } = await import('./tracking')
    const { CLIENT_BATCH } = await import('./events')
    await withFetch(async (calls) => {
      for (let i = 0; i < CLIENT_BATCH; i++) await trackEvent(BOOK, 'page_click', { x: i, y: i })
      expect(calls).toHaveLength(1)
    })
  })

  it('flushes everything on demand, in batches the route accepts', async () => {
    const { trackEvent, flushEvents } = await import('./tracking')
    const { CLIENT_BATCH, MAX_BATCH } = await import('./events')
    expect(CLIENT_BATCH).toBeLessThanOrEqual(MAX_BATCH)
    await withFetch(async (calls) => {
      for (let i = 0; i < 3; i++) await trackEvent(BOOK, 'hotspot_click', { hotspot_id: String(i) })
      flushEvents()
      expect(calls).toHaveLength(1)
      flushEvents()
      expect(calls).toHaveLength(1)
    })
  })

  it('queues nothing for editions with no database row', async () => {
    const { trackEvent, flushEvents } = await import('./tracking')
    await withFetch(async (calls) => {
      await trackEvent('gallery-fashion-lookbook', 'page_view', { page_number: 1 })
      flushEvents()
      expect(calls).toHaveLength(0)
    })
  })
})
