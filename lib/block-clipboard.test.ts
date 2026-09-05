import { beforeEach, describe, expect, it, vi } from 'vitest'
import { readClipboard, writeClipboard, clearClipboard, rekeyForPaste } from './block-clipboard'
import { useEditorStore } from './editor-store'
import type { Block, Book } from './book-schema'

/**
 * The editor clipboard, and multi-block selection.
 *
 * The thing worth testing here is not "copy then paste returns the same
 * blocks" — it is what happens to the things a page builder gets wrong: two
 * blocks sharing an id after a paste, six deletes becoming six undo steps, and
 * a clipboard written by an older version of the app being spread into a page
 * and only failing at save time.
 */

// jsdom is not the test environment here (`environment: 'node'`), so the module
// under test needs a localStorage. A Map is enough and makes the quota and
// private-mode paths testable, which a real one does not.
function installStorage(impl?: Partial<Storage>) {
  const store = new Map<string, string>()
  const base: Storage = {
    get length() {
      return store.size
    },
    clear: () => store.clear(),
    getItem: (k) => store.get(k) ?? null,
    key: (i) => [...store.keys()][i] ?? null,
    removeItem: (k) => void store.delete(k),
    setItem: (k, v) => void store.set(k, v),
  }
  vi.stubGlobal('localStorage', { ...base, ...impl })
}

function textBlock(id: string, content = 'Hello'): Block {
  return { type: 'text', id, variant: 'body', content } as Block
}

function bookWith(blocks: Block[]): Book {
  return {
    id: 'b1',
    slug: 'b',
    title: 'B',
    owner_id: 'o1',
    theme: { preset: 'ivory' },
    settings: { published: false, unlisted: false },
    pages: [
      { id: 'p1', book_id: 'b1', page_number: 1, type: 'cover', layout: 'hero', blocks, hotspots: [] },
      { id: 'p2', book_id: 'b1', page_number: 2, type: 'content', layout: 'text', blocks: [], hotspots: [] },
    ],
  } as unknown as Book
}

beforeEach(() => {
  installStorage()
  vi.stubGlobal('crypto', { randomUUID: () => `id-${Math.random().toString(36).slice(2, 10)}` })
})

describe('the clipboard', () => {
  it('round-trips blocks', () => {
    expect(writeClipboard([textBlock('a'), textBlock('b')])).toBe(true)
    expect(readClipboard().map((b) => b.id)).toEqual(['a', 'b'])
  })

  it('drops anything that is not a valid block', () => {
    // localStorage survives a deploy, so what comes back can be written by an
    // older version of the app. Spreading that into a page turns into "Could
    // not save these pages" much later, with nothing pointing at the paste.
    localStorage.setItem(
      'qlico:block-clipboard',
      JSON.stringify({ blocks: [textBlock('good'), { type: 'text' }, { type: 'nope', id: 'x' }], copiedAt: 0 })
    )
    expect(readClipboard().map((b) => b.id)).toEqual(['good'])
  })

  it('survives junk in storage', () => {
    localStorage.setItem('qlico:block-clipboard', 'not json at all')
    expect(readClipboard()).toEqual([])
  })

  it('refuses an empty or absurd copy', () => {
    expect(writeClipboard([])).toBe(false)
    expect(writeClipboard(Array.from({ length: 51 }, (_, i) => textBlock(`b${i}`)))).toBe(false)
  })

  it('reports failure rather than throwing when storage is unavailable', () => {
    // Private mode and a full quota both throw on setItem. An editor that
    // throws on Cmd+C is worse than one where the copy quietly did not take.
    installStorage({
      setItem: () => {
        throw new DOMException('QuotaExceededError')
      },
    })
    expect(writeClipboard([textBlock('a')])).toBe(false)
  })

  it('clears', () => {
    writeClipboard([textBlock('a')])
    clearClipboard()
    expect(readClipboard()).toEqual([])
  })
})

describe('rekeyForPaste', () => {
  it('gives every pasted block a new id', () => {
    // Two blocks with the same id on one page is the kind of thing React
    // renders once and then updates the wrong one of.
    const source = [textBlock('a'), textBlock('b')]
    const pasted = rekeyForPaste(source, false)
    expect(pasted.map((b) => b.id)).not.toEqual(['a', 'b'])
    expect(new Set(pasted.map((b) => b.id)).size).toBe(2)
  })

  it('deep-copies, so editing a paste does not edit the original', () => {
    const source = [{ ...textBlock('a'), frame: { x: 10, y: 10, w: 50, z: 0 } } as Block]
    const [pasted] = rekeyForPaste(source, false)
    ;(pasted as { content: string }).content = 'changed'
    expect((source[0] as { content: string }).content).toBe('Hello')
  })

  it('offsets a frame on a canvas page so the copy is visible', () => {
    const source = [{ ...textBlock('a'), frame: { x: 10, y: 10, w: 50, z: 0 } } as Block]
    const [pasted] = rekeyForPaste(source, true)
    expect(pasted.frame).toMatchObject({ x: 13, y: 13 })
  })

  it('does not push a frame off the page', () => {
    const source = [{ ...textBlock('a'), frame: { x: 95, y: 95, w: 50, z: 0 } } as Block]
    const [pasted] = rekeyForPaste(source, true)
    expect(pasted.frame!.x).toBeLessThanOrEqual(92)
    expect(pasted.frame!.y).toBeLessThanOrEqual(92)
  })
})

describe('selection', () => {
  beforeEach(() => {
    useEditorStore.setState({
      book: bookWith([textBlock('a'), textBlock('b'), textBlock('c')]),
      past: [],
      future: [],
      currentPageIndex: 0,
      selectedBlockId: null,
      selectedBlockIds: [],
    })
  })

  it('replaces the selection on a plain select', () => {
    const s = useEditorStore.getState()
    s.selectBlocks(['a', 'b'])
    s.selectBlock('c')
    expect(useEditorStore.getState().selectedBlockIds).toEqual(['c'])
  })

  it('extends and contracts on toggle', () => {
    const s = useEditorStore.getState()
    s.selectBlock('a')
    s.toggleBlockSelection('b')
    expect(useEditorStore.getState().selectedBlockIds).toEqual(['a', 'b'])
    useEditorStore.getState().toggleBlockSelection('b')
    expect(useEditorStore.getState().selectedBlockIds).toEqual(['a'])
  })

  it('moves the anchor when the anchor is deselected', () => {
    // The settings panel edits the anchor. Leaving it on a block that is no
    // longer selected means the panel edits something the author cannot see is
    // selected.
    const s = useEditorStore.getState()
    s.selectBlocks(['a', 'b'])
    expect(useEditorStore.getState().selectedBlockId).toBe('a')
    useEditorStore.getState().toggleBlockSelection('a')
    expect(useEditorStore.getState().selectedBlockId).toBe('b')
  })

  it('drops the block selection when a hotspot is selected', () => {
    const s = useEditorStore.getState()
    s.selectBlocks(['a', 'b'])
    useEditorStore.getState().selectHotspot('h1')
    expect(useEditorStore.getState().selectedBlockIds).toEqual([])
  })
})

describe('copy and paste through the store', () => {
  beforeEach(() => {
    useEditorStore.setState({
      book: bookWith([textBlock('a', 'One'), textBlock('b', 'Two'), textBlock('c', 'Three')]),
      past: [],
      future: [],
      currentPageIndex: 0,
      selectedBlockId: null,
      selectedBlockIds: [],
    })
  })

  it('copies in page order, not click order', () => {
    // Pasting should reproduce the arrangement that was copied.
    useEditorStore.getState().copyBlocks('p1', ['c', 'a'])
    expect(readClipboard().map((b) => (b as { content: string }).content)).toEqual(['One', 'Three'])
  })

  it('pastes onto another page in the same edition', () => {
    useEditorStore.getState().copyBlocks('p1', ['a', 'b'])
    const n = useEditorStore.getState().pasteBlocks('p2')
    expect(n).toBe(2)
    const p2 = useEditorStore.getState().book!.pages![1]
    expect(p2.blocks.map((b) => (b as { content: string }).content)).toEqual(['One', 'Two'])
    // New ids, or the two pages fight over the same block.
    expect(p2.blocks.map((b) => b.id)).not.toContain('a')
  })

  it('pastes below the anchor rather than at the end', () => {
    useEditorStore.getState().copyBlocks('p1', ['a'])
    useEditorStore.getState().pasteBlocks('p1', 'a')
    const contents = useEditorStore.getState().book!.pages![0].blocks.map((b) => (b as { content: string }).content)
    expect(contents).toEqual(['One', 'One', 'Two', 'Three'])
  })

  it('selects what was pasted', () => {
    useEditorStore.getState().copyBlocks('p1', ['a', 'b'])
    useEditorStore.getState().pasteBlocks('p2')
    const state = useEditorStore.getState()
    expect(state.selectedBlockIds).toHaveLength(2)
    expect(state.selectedBlockId).toBe(state.selectedBlockIds[0])
  })

  it('pastes nothing when the clipboard is empty', () => {
    clearClipboard()
    expect(useEditorStore.getState().pasteBlocks('p1')).toBe(0)
  })

  it('deletes a selection as one undo step', () => {
    // Deleting six blocks and pressing undo should bring six back, not one.
    useEditorStore.getState().removeBlocks('p1', ['a', 'b'])
    expect(useEditorStore.getState().book!.pages![0].blocks.map((b) => b.id)).toEqual(['c'])
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().book!.pages![0].blocks.map((b) => b.id)).toEqual(['a', 'b', 'c'])
  })

  it('undoes a paste in one step', () => {
    useEditorStore.getState().copyBlocks('p1', ['a', 'b'])
    useEditorStore.getState().pasteBlocks('p1', 'c')
    expect(useEditorStore.getState().book!.pages![0].blocks).toHaveLength(5)
    useEditorStore.getState().undo()
    expect(useEditorStore.getState().book!.pages![0].blocks).toHaveLength(3)
  })
})
