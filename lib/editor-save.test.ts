import { describe, it, expect } from 'vitest'
import { z } from 'zod'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  PageSchema,
  BlockSchema,
  HotspotSchema,
  EmbedBlockSchema,
  BookSettingsSchema,
} from './book-schema'

/**
 * Regression suite for the save path.
 *
 * `draftableUrl` / `draftableHref` fixed most of this: a target the author has
 * not chosen yet is a valid draft, and `lib/publish-checks.ts` is what stops it
 * going live. Three fields were missed, and they fail the same way — the save
 * route validates the whole edition as one array, so one of them 400s every
 * autosave for every page, reported as "Could not save these pages".
 */

/** Exactly what the route validates: EditorClient's payload, minus book_id. */
const SavePayload = z.array(PageSchema.omit({ book_id: true }))

const page = (extra: Record<string, unknown> = {}) => ({
  id: 'p1', page_number: 1, type: 'content', layout: 'text', blocks: [], hotspots: [], ...extra,
})

describe('a hotspot whose modal media is still being chosen', () => {
  const base = { id: 'h', x: 50, y: 50, label: 'Shop the coat', icon: 'Info', action: 'modal' as const }

  it('an empty media src saves', () => {
    const r = HotspotSchema.safeParse({
      ...base,
      modal: { title: 'Coat', body: 'Silk trench.', media: { type: 'image', src: '' } },
    })
    expect(r.success).toBe(true)
  })

  it('an empty media poster saves', () => {
    const r = HotspotSchema.safeParse({
      ...base,
      modal: {
        title: 'Coat', body: 'Silk trench.',
        media: { type: 'video', src: 'https://x.test/v.mp4', poster: '' },
      },
    })
    expect(r.success).toBe(true)
  })

  it('and a script scheme in modal media is still refused', () => {
    const r = HotspotSchema.safeParse({
      ...base,
      modal: { title: 'C', body: 'B', media: { type: 'image', src: 'javascript:alert(1)' } },
    })
    expect(r.success).toBe(false)
  })
})

describe('a page whose ambient track is still being chosen', () => {
  it('an empty ambient src saves', () => {
    const r = SavePayload.safeParse([page({ ambientAudio: { src: '', loop: true, volume: 0.5 } })])
    expect(r.success).toBe(true)
  })

  it('and a script scheme is still refused', () => {
    const r = SavePayload.safeParse([
      page({ ambientAudio: { src: 'javascript:alert(1)', loop: true, volume: 0.5 } }),
    ])
    expect(r.success).toBe(false)
  })
})

describe('an embed whose height field is mid-edit', () => {
  // type="number" + valueAsNumber yields NaN for an empty input, and JSON turns
  // NaN into null on the way to the server. Neither should cost a save.
  it('NaN falls back rather than rejecting', () => {
    const r = EmbedBlockSchema.safeParse({ type: 'embed', id: 'e', html: '<i>', height: NaN })
    expect(r.success).toBe(true)
    expect(r.success && r.data.height).toBe(300)
  })

  it('null falls back rather than rejecting', () => {
    const r = EmbedBlockSchema.safeParse({ type: 'embed', id: 'e', html: '<i>', height: null })
    expect(r.success).toBe(true)
    expect(r.success && r.data.height).toBe(300)
  })

  it('a real height is untouched', () => {
    const r = EmbedBlockSchema.parse({ type: 'embed', id: 'e', html: '<i>', height: 420 })
    expect(r.height).toBe(420)
  })
})

describe('one unfinished block does not take the rest of the edition with it', () => {
  it('a good page and a half-typed page save together', () => {
    const payload = [
      page({
        id: 'p1', page_number: 1,
        blocks: [{ type: 'text', id: 't', variant: 'body', content: 'hours of work' }],
      }),
      page({
        id: 'p2', page_number: 2,
        ambientAudio: { src: '', loop: true, volume: 0.5 },
        blocks: [{ type: 'embed', id: 'e', html: '<i>', height: NaN }],
      }),
    ]
    expect(SavePayload.safeParse(payload).success).toBe(true)
  })
})

describe('the save payload carries every field the page schema keeps', () => {
  /**
   * EditorClient hand-lists the page fields it sends. Anything added to
   * PageSchema and not added there is silently dropped on the next autosave —
   * which is what happened to `ambientAudio`: ViewerChrome still reads it, and
   * the first save after opening a template or an imported PDF wiped it.
   */
  it('no page field is left behind', () => {
    // Read the real payload out of the component, so adding a field to
    // PageSchema and forgetting this map fails here rather than in production.
    const source = readFileSync(
      join(__dirname, '..', 'components', 'studio', 'EditorClient.tsx'),
      'utf-8'
    )
    const map = source.match(/\(bookAtSaveStart\.pages \?\? \[\]\)\.map\(\(p\) => \(\{([\s\S]*?)\}\)\)/)
    expect(map, 'could not find the page payload in EditorClient').not.toBeNull()

    const sent = [...map![1].matchAll(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*:/gm)].map((m) => m[1])
    const kept = Object.keys(PageSchema.shape).filter((k) => k !== 'book_id')

    expect([...new Set(sent)].sort()).toEqual([...kept].sort())
  })

  it('ambient audio round-trips through the route schema', () => {
    const r = SavePayload.safeParse([
      page({ ambientAudio: { src: 'https://x.test/a.mp3', loop: true, volume: 0.5 } }),
    ])
    expect(r.success).toBe(true)
    expect(r.success && r.data[0].ambientAudio?.src).toBe('https://x.test/a.mp3')
  })
})

describe('what must still be refused', () => {
  it.each([
    'javascript:alert(document.cookie)',
    'JavaScript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
  ])('a button href of %j', (href) => {
    const r = BlockSchema.safeParse({ type: 'button', id: 'b', label: 'x', href, variant: 'primary' })
    expect(r.success).toBe(false)
  })
})

describe('a number field the author is mid-way through retyping', () => {
  // Same shape as the URL fields: a `type="number"` input cleared in order to
  // be retyped gives NaN (valueAsNumber), and JSON makes that null. A plain
  // z.number() refused both, and the save routes validate a whole edition — or
  // a whole settings object — at once, so it failed everything.

  it('the lead gate page number, cleared', () => {
    const settings = (page_number: unknown) =>
      BookSettingsSchema.safeParse({
        published: false, unlisted: false, whitelabel: false,
        gating: { enabled: true, page_number, type: 'email', title: 't', description: 'd' },
      })
    expect(settings(NaN).success).toBe(true)
    expect(settings(null).success).toBe(true)
    const parsed = BookSettingsSchema.parse({
      published: false, unlisted: false, whitelabel: false,
      gating: { enabled: true, page_number: NaN, type: 'email', title: 't', description: 'd' },
    })
    expect(parsed.gating.page_number).toBe(3)
  })

  it('a hotspot step number typed as 0, or above the range', () => {
    const step = (stepNumber: number) =>
      HotspotSchema.parse({
        id: 'h', x: 1, y: 1, label: 'l', action: 'modal',
        stepNumber, modal: { title: 't', body: 'b' },
      }).stepNumber
    expect(step(0)).toBe(1)    // clamped, not refused
    expect(step(500)).toBe(99)
    expect(step(7)).toBe(7)
  })

  it('an embed height, cleared and then given a real value', () => {
    expect(EmbedBlockSchema.parse({ type: 'embed', id: 'e', html: '<i>', height: NaN }).height).toBe(300)
    expect(EmbedBlockSchema.parse({ type: 'embed', id: 'e', html: '<i>', height: 420 }).height).toBe(420)
  })
})
