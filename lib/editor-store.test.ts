import { beforeEach, describe, expect, it } from 'vitest'
import { useEditorStore } from './editor-store'
import type { Book } from './book-schema'

function book(title = 'B'): Book {
  return {
    id: 'b1',
    slug: 'b',
    title,
    owner_id: 'o1',
    theme: { preset: 'ivory' },
    settings: { published: false, unlisted: false },
    pages: [
      {
        id: 'p1',
        book_id: 'b1',
        page_number: 1,
        type: 'cover',
        layout: 'hero',
        blocks: [],
        hotspots: [],
      },
    ],
  } as unknown as Book
}

describe('editor history', () => {
  beforeEach(() => {
    useEditorStore.setState({
      book: book(),
      past: [],
      future: [],
      lastEditKey: null,
      lastEditAt: 0,
      currentPageIndex: 0,
    })
  })

  it('caps undo depth so a long session cannot grow without bound', () => {
    const store = useEditorStore.getState()
    // Each structural edit is its own snapshot of the entire book.
    for (let i = 0; i < 200; i++) {
      useEditorStore.getState().addPage()
    }
    const { past } = useEditorStore.getState()
    expect(past.length).toBeLessThanOrEqual(60)
    expect(store).toBeDefined()
  })

  it('keeps the most recent snapshots, not the oldest', () => {
    useEditorStore.setState({ book: book('first') })
    for (let i = 0; i < 80; i++) {
      useEditorStore.setState((s) => ({ book: { ...s.book!, title: `t${i}` } }))
      useEditorStore.getState().addPage()
    }
    const { past } = useEditorStore.getState()
    // The oldest title must have been evicted; the newest must still be there.
    expect(past.some((b) => b.title === 'first')).toBe(false)
    expect(past.length).toBe(60)
  })

  it('still undoes and redoes within the cap', () => {
    const before = useEditorStore.getState().book!.pages!.length
    useEditorStore.getState().addPage()
    expect(useEditorStore.getState().book!.pages!.length).toBe(before + 1)

    useEditorStore.getState().undo()
    expect(useEditorStore.getState().book!.pages!.length).toBe(before)

    useEditorStore.getState().redo()
    expect(useEditorStore.getState().book!.pages!.length).toBe(before + 1)
  })

  it('does nothing when there is no history to walk', () => {
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().past).toHaveLength(0)
    useEditorStore.getState().redo()
    expect(useEditorStore.getState().future).toHaveLength(0)
  })
})

describe('insertPage', () => {
  beforeEach(() => {
    useEditorStore.setState({
      book: {
        ...book(),
        pages: [1, 2, 3].map((n) => ({
          id: `p${n}`,
          book_id: 'b1',
          page_number: n,
          type: 'content' as const,
          layout: 'text' as const,
          blocks: [],
          hotspots: [],
        })),
      },
      past: [],
      future: [],
      lastEditKey: null,
      lastEditAt: 0,
      currentPageIndex: 0,
    })
  })

  it('puts the page after the one you are on, not at the end', () => {
    useEditorStore.getState().insertPage(0)
    const pages = useEditorStore.getState().book!.pages!
    expect(pages).toHaveLength(4)
    expect(pages[1].blocks).toEqual([])
    // The old page 2 has moved down rather than been overwritten.
    expect(pages[2].id).toBe('p2')
  })

  it('renumbers every page so page_number still matches position', () => {
    useEditorStore.getState().insertPage(1)
    const pages = useEditorStore.getState().book!.pages!
    expect(pages.map((p) => p.page_number)).toEqual([1, 2, 3, 4])
  })

  it('selects the page it just made', () => {
    useEditorStore.getState().insertPage(1)
    expect(useEditorStore.getState().currentPageIndex).toBe(2)
  })

  it('seeds blocks when a layout supplies them', () => {
    useEditorStore.getState().insertPage(0, {
      layout: 'hero',
      blocks: [{ id: 'x', type: 'text', variant: 'heading', content: 'Hi' }],
    })
    const inserted = useEditorStore.getState().book!.pages![1]
    expect(inserted.layout).toBe('hero')
    expect(inserted.blocks).toHaveLength(1)
  })
})

describe('addHotspotsBatch', () => {
  beforeEach(() => {
    useEditorStore.setState({
      book: {
        ...book(),
        pages: [1, 2].map((n) => ({
          id: `p${n}`,
          book_id: 'b1',
          page_number: n,
          type: 'content' as const,
          layout: 'text' as const,
          blocks: [],
          hotspots: [],
        })),
      },
      past: [],
      future: [],
      lastEditKey: null,
      lastEditAt: 0,
      currentPageIndex: 0,
    })
  })

  const pin = (id: string) => ({
    id,
    x: 50,
    y: 50,
    label: id,
    icon: 'Info',
    action: 'modal' as const,
    modal: { title: id, body: '' },
  })

  it('spreads hotspots across the pages they belong to', () => {
    useEditorStore.getState().addHotspotsBatch([
      { pageId: 'p1', hotspots: [pin('a'), pin('b')] },
      { pageId: 'p2', hotspots: [pin('c')] },
    ])
    const pages = useEditorStore.getState().book!.pages!
    expect(pages[0].hotspots).toHaveLength(2)
    expect(pages[1].hotspots).toHaveLength(1)
  })

  it('costs one undo, not one per hotspot', () => {
    // This is the whole reason the action exists: the post-import step offers
    // "add all 21" and promises a single ⌘Z takes it back. addHotspot snapshots
    // per call, so doing it one at a time would need 21 presses.
    useEditorStore.getState().addHotspotsBatch([
      { pageId: 'p1', hotspots: [pin('a'), pin('b'), pin('c')] },
      { pageId: 'p2', hotspots: [pin('d')] },
    ])
    expect(useEditorStore.getState().past).toHaveLength(1)

    useEditorStore.getState().undo()
    const pages = useEditorStore.getState().book!.pages!
    expect(pages[0].hotspots).toHaveLength(0)
    expect(pages[1].hotspots).toHaveLength(0)
  })

  it('leaves pages the detector found nothing on untouched', () => {
    const before = useEditorStore.getState().book!.pages![1]
    useEditorStore.getState().addHotspotsBatch([{ pageId: 'p1', hotspots: [pin('a')] }])
    expect(useEditorStore.getState().book!.pages![1]).toBe(before)
  })
})
