import { describe, it, expect, beforeEach } from 'vitest'
import { useEditorStore } from './editor-store'
import type { Book, Page } from './book-schema'

/**
 * Editing one page must leave every other page's object identity alone.
 *
 * `PageListSidebar` draws a full `PageRenderer` per thumbnail — the real page,
 * every block, every image — and is memoised on `page` by reference. Before
 * that memo, one keystroke in the inspector re-rendered the entire book, and a
 * single `<select>` change blocked the UI for over a second on a book of any
 * size.
 *
 * The memo is only correct because the store's updaters rebuild the page they
 * touch and return the same reference for the rest. An updater rewritten to
 * map every page into a fresh object would silently restore the old behaviour:
 * nothing would break, the editor would just get slow again in proportion to
 * page count. This is that guard.
 */

function makePage(n: number): Page {
  return {
    id: `p${n}`,
    book_id: 'bk',
    page_number: n,
    type: 'content',
    layout: 'text',
    blocks: [{ type: 'text', id: `t${n}`, variant: 'body', content: `page ${n}` }],
    hotspots: [{ id: `h${n}`, x: 10, y: 10, label: 'spot', icon: 'Info', action: 'modal', modal: { title: 't', body: 'b' } }],
  }
}

const book: Book = {
  id: 'bk',
  slug: 'test-edition',
  title: 'Test',
  owner_id: 'o',
  theme: { preset: 'ivory' },
  settings: {
    published: false,
    unlisted: false,
    whitelabel: false,
    gating: { enabled: false, page_number: 3, type: 'email', title: 't', description: 'd' },
  },
  pages: [makePage(1), makePage(2), makePage(3), makePage(4), makePage(5)],
}

/** Which pages kept their identity, by page number. */
function untouched(before: Page[], after: Page[]) {
  return after.filter((p, i) => p === before[i]).map((p) => p.page_number)
}

describe('editing one page leaves the others by reference', () => {
  beforeEach(() => {
    useEditorStore.setState({ past: [], future: [], lastEditKey: null, lastEditAt: 0 })
    useEditorStore.getState().setBook(structuredClone(book))
  })

  const pagesNow = () => useEditorStore.getState().book!.pages!

  it('updateBlock touches only its own page', () => {
    const before = pagesNow()
    useEditorStore.getState().updateBlock('p3', 't3', { content: 'edited' } as never)
    const after = pagesNow()

    expect(untouched(before, after)).toEqual([1, 2, 4, 5])
    expect(after[2]).not.toBe(before[2])
    expect(after[2].blocks[0]).toMatchObject({ content: 'edited' })
  })

  it('updateHotspot touches only its own page', () => {
    const before = pagesNow()
    useEditorStore.getState().updateHotspot('p2', 'h2', { label: 'moved' })
    expect(untouched(before, pagesNow())).toEqual([1, 3, 4, 5])
  })

  it('updatePage touches only its own page', () => {
    const before = pagesNow()
    useEditorStore.getState().updatePage('p5', { layout: 'grid' })
    expect(untouched(before, pagesNow())).toEqual([1, 2, 3, 4])
  })

  it('a run of edits to one page never disturbs the rest', () => {
    // The realistic case: typing. Every keystroke is an updateBlock.
    const before = pagesNow()
    for (let i = 0; i < 25; i++) {
      useEditorStore.getState().updateBlock('p1', 't1', { content: 'x'.repeat(i) } as never)
    }
    expect(untouched(before, pagesNow())).toEqual([2, 3, 4, 5])
  })

  it('and the edited page really did change, so the memo still repaints it', () => {
    const before = pagesNow()
    useEditorStore.getState().updateBlock('p1', 't1', { content: 'new' } as never)
    expect(pagesNow()[0]).not.toBe(before[0])
  })
})

describe('undo history holds snapshots by reference, not copies', () => {
  beforeEach(() => {
    useEditorStore.setState({ past: [], future: [], lastEditKey: null, lastEditAt: 0 })
    useEditorStore.getState().setBook(structuredClone(book))
  })

  it('a snapshot is the previous book object itself', () => {
    const original = useEditorStore.getState().book
    useEditorStore.getState().updateBlock('p1', 't1', { content: 'a' } as never)
    const { past } = useEditorStore.getState()
    // If this ever deep-clones, every edit pays for a full copy of the edition.
    expect(past[past.length - 1]).toBe(original)
  })
})
