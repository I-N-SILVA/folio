import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './editor-store'
import { PageSchema } from './book-schema'
import type { Book } from './book-schema'

function seededBook(): Book {
  return {
    id: 'b1',
    slug: 'b',
    title: 'B',
    owner_id: 'o1',
    theme: { preset: 'ivory' },
    settings: { published: false, unlisted: false },
    pages: [
      {
        id: 'p1',
        book_id: 'b1',
        page_number: 1,
        type: 'content',
        layout: 'text',
        blocks: [
          { id: 'a', type: 'text', variant: 'heading', content: 'One' },
          { id: 'b', type: 'text', variant: 'body', content: 'Two' },
        ],
        hotspots: [],
      },
    ],
  } as unknown as Book
}

describe('canvas layout mode', () => {
  beforeEach(() => {
    useEditorStore.setState({
      book: seededBook(),
      past: [],
      future: [],
      lastEditKey: null,
      lastEditAt: 0,
      currentPageIndex: 0,
    })
  })

  const page = () => useEditorStore.getState().book!.pages![0]

  it('seeds a frame on every block when a page becomes a canvas', () => {
    useEditorStore.getState().setPageLayoutMode('p1', 'canvas')
    expect(page().layout).toBe('canvas')
    expect(page().blocks.every((b) => b.frame)).toBe(true)
  })

  it('seeds frames from the order the blocks were already in, so nothing scatters', () => {
    useEditorStore.getState().setPageLayoutMode('p1', 'canvas')
    const [first, second] = page().blocks
    expect(first.frame!.y).toBeLessThan(second.frame!.y)
    expect(first.frame!.x).toBe(second.frame!.x)
  })

  it('is lossless both ways — flow ignores frames rather than destroying them', () => {
    useEditorStore.getState().setPageLayoutMode('p1', 'canvas')
    useEditorStore.getState().setBlockFrame('p1', 'a', { x: 40, y: 60, w: 30, z: 0 })
    useEditorStore.getState().setPageLayoutMode('p1', 'text')
    expect(page().layout).toBe('text')
    expect(page().blocks[0].frame).toEqual({ x: 40, y: 60, w: 30, z: 0 })

    useEditorStore.getState().setPageLayoutMode('p1', 'canvas')
    expect(page().blocks[0].frame).toEqual({ x: 40, y: 60, w: 30, z: 0 })
  })

  it('leaves a block that already has a frame alone', () => {
    useEditorStore.getState().setPageLayoutMode('p1', 'canvas')
    const kept = page().blocks[1].frame
    useEditorStore.getState().setPageLayoutMode('p1', 'text')
    useEditorStore.getState().setPageLayoutMode('p1', 'canvas')
    expect(page().blocks[1].frame).toEqual(kept)
  })

  it('accepts a canvas page through the schema, frames and all', () => {
    useEditorStore.getState().setPageLayoutMode('p1', 'canvas')
    const parsed = PageSchema.safeParse(page())
    expect(parsed.success).toBe(true)
  })

  it('still accepts a flow page with no frames anywhere', () => {
    expect(PageSchema.safeParse(page()).success).toBe(true)
  })
})
