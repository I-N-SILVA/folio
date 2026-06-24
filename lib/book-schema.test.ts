import { describe, it, expect } from 'vitest'
import { BlockSchema, PageSchema, BookSchema, HotspotSchema } from './book-schema'

describe('BlockSchema', () => {
  it('parses a valid text block', () => {
    const r = BlockSchema.safeParse({
      type: 'text',
      id: 't1',
      variant: 'body',
      content: 'hello',
    })
    expect(r.success).toBe(true)
  })

  it('rejects an image block with a non-URL src', () => {
    const r = BlockSchema.safeParse({ type: 'image', id: 'i1', src: 'not-a-url', alt: 'x' })
    expect(r.success).toBe(false)
  })

  it('discriminates on type — unknown type is rejected', () => {
    const r = BlockSchema.safeParse({ type: 'iframe', id: 'x' })
    expect(r.success).toBe(false)
  })
})

describe('HotspotSchema', () => {
  it('clamps coordinates to the 0–100 range', () => {
    const base = {
      id: 'h1',
      label: 'spot',
      modal: { title: 'T', body: 'B' },
    }
    expect(HotspotSchema.safeParse({ ...base, x: 50, y: 50 }).success).toBe(true)
    expect(HotspotSchema.safeParse({ ...base, x: 150, y: 50 }).success).toBe(false)
    expect(HotspotSchema.safeParse({ ...base, x: -1, y: 50 }).success).toBe(false)
  })

  it('defaults action to modal and icon to Info', () => {
    const r = HotspotSchema.parse({ id: 'h', x: 1, y: 1, label: 'l', modal: { title: 't', body: 'b' } })
    expect(r.action).toBe('modal')
    expect(r.icon).toBe('Info')
  })
})

describe('PageSchema', () => {
  it('defaults blocks and hotspots to empty arrays', () => {
    const r = PageSchema.parse({
      id: 'p1',
      book_id: 'b1',
      page_number: 1,
      type: 'cover',
      layout: 'blank',
    })
    expect(r.blocks).toEqual([])
    expect(r.hotspots).toEqual([])
  })

  it('requires a positive page number', () => {
    const bad = PageSchema.safeParse({
      id: 'p1',
      book_id: 'b1',
      page_number: 0,
      type: 'cover',
      layout: 'blank',
    })
    expect(bad.success).toBe(false)
  })
})

describe('BookSchema', () => {
  it('enforces the slug pattern', () => {
    const make = (slug: string) =>
      BookSchema.safeParse({ id: 'b', slug, title: 'T', owner_id: 'o' })
    expect(make('my-book').success).toBe(true)
    expect(make('My Book').success).toBe(false)
    expect(make('under_score').success).toBe(false)
  })
})
