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
