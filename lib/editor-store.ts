import { create } from 'zustand'
import type { Book, Page, Block, Hotspot, Frame } from './book-schema'

interface EditorStore {
  book: Book | null
  currentPageIndex: number
  selectedBlockId: string | null
  selectedHotspotId: string | null
  hotspotMode: boolean
  isDirty: boolean
  isSaving: boolean
  past: Book[]
  future: Book[]
  /** Which field is being edited + when, so rapid keystrokes coalesce into
   *  one undo step instead of one per keystroke. */
  lastEditKey: string | null
  lastEditAt: number

  setBook: (book: Book) => void
  setCurrentPageIndex: (idx: number) => void
  selectBlock: (id: string | null) => void
  selectHotspot: (id: string | null) => void
  setHotspotMode: (on: boolean) => void
  setIsSaving: (saving: boolean) => void

  updatePage: (pageId: string, updates: Partial<Page>) => void
  updateBlock: (pageId: string, blockId: string, updates: Partial<Block>) => void
  /** Move or resize a block on a canvas page. */
  setBlockFrame: (pageId: string, blockId: string, frame: Frame) => void
  /**
   * Switch a page between flow and canvas, seeding frames on the way in so the
   * page never scatters.
   */
  setPageLayoutMode: (pageId: string, layout: Page['layout'], seed?: Record<string, Frame>) => void
  addBlock: (pageId: string, block: Block) => void
  insertBlockAt: (pageId: string, block: Block, index: number) => void
  duplicateBlock: (pageId: string, blockId: string) => void
  removeBlock: (pageId: string, blockId: string) => void
  moveBlock: (pageId: string, blockId: string, direction: 'up' | 'down') => void

  addHotspot: (pageId: string, hotspot: Hotspot) => void
  /** Add hotspots across many pages as a single undoable step. */
  addHotspotsBatch: (byPage: { pageId: string; hotspots: Hotspot[] }[]) => void
  updateHotspot: (pageId: string, hotspotId: string, updates: Partial<Hotspot>) => void
  removeHotspot: (pageId: string, hotspotId: string) => void

  addPage: () => void
  /** Insert a page directly after `afterIndex`, optionally pre-filled. */
  insertPage: (afterIndex: number, page?: Partial<Pick<Page, 'layout' | 'blocks'>>) => void
  removePage: (pageId: string) => void
  reorderPages: (fromIndex: number, toIndex: number) => void
  setPageBlocks: (pageId: string, blocks: Block[]) => void
  updateSettings: (updates: Partial<Book['settings']>) => void
  updateTheme: (updates: Partial<Book['theme']>) => void

  undo: () => void
  redo: () => void
}

// How long a run of edits to the same field coalesces into a single undo
// step. Long enough to absorb a burst of keystrokes, short enough that
// pausing to think starts a fresh step.
const HISTORY_COALESCE_MS = 800

/**
 * Undo depth. Each entry is a deep snapshot of the whole book — every page,
 * block, and hotspot — so an uncapped history grew without bound for as long as
 * a tab stayed open. A fifty-page edition is a substantial object, and a long
 * editing session pushes hundreds of them.
 */
const MAX_HISTORY = 60

/** Appends a snapshot, dropping the oldest once the cap is reached. */
function pushHistory(past: Book[], book: Book): Book[] {
  const next = [...past, book]
  return next.length > MAX_HISTORY ? next.slice(next.length - MAX_HISTORY) : next
}

type HistoryState = Pick<EditorStore, 'past' | 'lastEditKey' | 'lastEditAt'>

/**
 * History patch for a field edit that should coalesce rapid keystrokes into
 * one undo step: only pushes `book` onto `past` when the edit target
 * changed or enough time passed since the last edit to the same target.
 */
function coalescedHistory(state: HistoryState, book: Book, key: string) {
  const now = Date.now()
  const isNewStep = state.lastEditKey !== key || now - state.lastEditAt > HISTORY_COALESCE_MS
  return {
    lastEditKey: key,
    lastEditAt: now,
    ...(isNewStep ? { past: pushHistory(state.past, book), future: [] } : {}),
  }
}

/** History patch for a structural edit (add/remove/reorder) — always its own undo step. */
function snapshotHistory(state: Pick<EditorStore, 'past'>, book: Book) {
  return { past: pushHistory(state.past, book), future: [] }
}

export const useEditorStore = create<EditorStore>((set, get) => ({
  book: null,
  currentPageIndex: 0,
  selectedBlockId: null,
  selectedHotspotId: null,
  hotspotMode: false,
  isDirty: false,
  isSaving: false,
  past: [],
  future: [],
  lastEditKey: null,
  lastEditAt: 0,

  setBook: (book) => set({ book, isDirty: false }),
  setCurrentPageIndex: (idx) => set({ currentPageIndex: idx, selectedBlockId: null, selectedHotspotId: null }),
  selectBlock: (id) => set({ selectedBlockId: id, selectedHotspotId: null }),
  selectHotspot: (id) => set({ selectedHotspotId: id, selectedBlockId: null }),
  setHotspotMode: (on) => set({ hotspotMode: on }),
  setIsSaving: (saving) => set({ isSaving: saving }),

  updateSettings: (updates) => set((state) => {
    if (!state.book) return state
    return {
      isDirty: true,
      ...coalescedHistory(state, state.book, 'settings'),
      book: {
        ...state.book,
        settings: { ...state.book.settings, ...updates } as any,
      },
    }
  }),

  updateTheme: (updates) => set((state) => {
    if (!state.book) return state
    return {
      isDirty: true,
      ...coalescedHistory(state, state.book, 'theme'),
      book: {
        ...state.book,
        theme: { ...state.book.theme, ...updates } as any,
      },
    }
  }),

  updatePage: (pageId, updates) => set((state) => {
    if (!state.book?.pages) return state
    return {
      isDirty: true,
      ...coalescedHistory(state, state.book, `page:${pageId}`),
      book: {
        ...state.book,
        pages: state.book.pages.map((p) => p.id === pageId ? { ...p, ...updates } : p),
      },
    }
  }),

  updateBlock: (pageId, blockId, updates) => set((state) => {
    if (!state.book?.pages) return state
    return {
      isDirty: true,
      ...coalescedHistory(state, state.book, `block:${blockId}`),
      book: {
        ...state.book,
        pages: state.book.pages.map((p) =>
          p.id === pageId
            ? { ...p, blocks: p.blocks.map((b) => b.id === blockId ? { ...b, ...updates } as Block : b) }
            : p
        ),
      },
    }
  }),

  setBlockFrame: (pageId, blockId, frame) => set((state) => {
    if (!state.book?.pages) return state
    // Keyed history: a drag is hundreds of updates, and each one landing its own
    // snapshot would bury every earlier edit under a single gesture.
    return {
      isDirty: true,
      ...coalescedHistory(state, state.book, `frame:${blockId}`),
      book: {
        ...state.book,
        pages: state.book.pages.map((p) =>
          p.id === pageId
            ? {
                ...p,
                blocks: p.blocks.map((b) => (b.id === blockId ? ({ ...b, frame } as Block) : b)),
              }
            : p
        ),
      },
    }
  }),

  setPageLayoutMode: (pageId, layout, seed) => set((state) => {
    if (!state.book?.pages) return state
    return {
      isDirty: true,
      ...snapshotHistory(state, state.book),
      book: {
        ...state.book,
        pages: state.book.pages.map((p) => {
          if (p.id !== pageId) return p
          if (layout !== 'canvas') return { ...p, layout }
          // Seed from where the blocks actually are, so switching to canvas
          // shows the same page rather than a pile in the corner. `seed` is
          // measured off the live flow layout by the editor; the index-derived
          // fallback is for callers with no DOM to measure. A block that already
          // has a frame keeps it — switching back and forth is lossless, because
          // flow simply ignores `frame` rather than the canvas destroying it.
          return {
            ...p,
            layout,
            blocks: p.blocks.map((b, i) =>
              b.frame
                ? b
                : ({
                    ...b,
                    frame: seed?.[b.id] ?? { x: 8, y: Math.min(92, 8 + i * 15), w: 84, z: i },
                  } as Block)
            ),
          }
        }),
      },
    }
  }),

  addBlock: (pageId, block) => set((state) => {
    if (!state.book?.pages) return state
    return {
      isDirty: true,
      selectedBlockId: block.id,
      ...snapshotHistory(state, state.book),
      book: {
        ...state.book,
        pages: state.book.pages.map((p) =>
          p.id === pageId ? { ...p, blocks: [...p.blocks, block] } : p
        ),
      },
    }
  }),

  insertBlockAt: (pageId, block, index) => set((state) => {
    if (!state.book?.pages) return state
    const page = state.book.pages.find((p) => p.id === pageId)
    if (!page) return state
    const nextBlocks = [...page.blocks]
    const clamped = Math.max(0, Math.min(nextBlocks.length, index))
    nextBlocks.splice(clamped, 0, block)
    return {
      isDirty: true,
      selectedBlockId: block.id,
      ...snapshotHistory(state, state.book),
      book: {
        ...state.book,
        pages: state.book.pages.map((p) => (p.id === pageId ? { ...p, blocks: nextBlocks } : p)),
      },
    }
  }),

  duplicateBlock: (pageId, blockId) => set((state) => {
    if (!state.book?.pages) return state
    const page = state.book.pages.find((p) => p.id === pageId)
    if (!page) return state
    const idx = page.blocks.findIndex((b) => b.id === blockId)
    if (idx === -1) return state
    const original = page.blocks[idx]
    const cloned = { ...JSON.parse(JSON.stringify(original)), id: crypto.randomUUID() } as Block
    const nextBlocks = [...page.blocks]
    nextBlocks.splice(idx + 1, 0, cloned)
    return {
      isDirty: true,
      selectedBlockId: cloned.id,
      ...snapshotHistory(state, state.book),
      book: {
        ...state.book,
        pages: state.book.pages.map((p) => (p.id === pageId ? { ...p, blocks: nextBlocks } : p)),
      },
    }
  }),

  removeBlock: (pageId, blockId) => set((state) => {
    if (!state.book?.pages) return state
    return {
      isDirty: true,
      selectedBlockId: null,
      ...snapshotHistory(state, state.book),
      book: {
        ...state.book,
        pages: state.book.pages.map((p) =>
          p.id === pageId ? { ...p, blocks: p.blocks.filter((b) => b.id !== blockId) } : p
        ),
      },
    }
  }),

  moveBlock: (pageId, blockId, direction) => set((state) => {
    if (!state.book?.pages) return state
    const page = state.book.pages.find((p) => p.id === pageId)
    if (!page) return state
    const idx = page.blocks.findIndex((b) => b.id === blockId)
    const newBlocks = [...page.blocks]
    const targetIdx = direction === 'up' ? idx - 1 : idx + 1
    if (targetIdx < 0 || targetIdx >= newBlocks.length) return state
    ;[newBlocks[idx], newBlocks[targetIdx]] = [newBlocks[targetIdx], newBlocks[idx]]
    return {
      isDirty: true,
      ...snapshotHistory(state, state.book),
      book: {
        ...state.book,
        pages: state.book.pages.map((p) => p.id === pageId ? { ...p, blocks: newBlocks } : p),
      },
    }
  }),

  addHotspot: (pageId, hotspot) => set((state) => {
    if (!state.book?.pages) return state
    return {
      isDirty: true,
      selectedHotspotId: hotspot.id,
      ...snapshotHistory(state, state.book),
      book: {
        ...state.book,
        pages: state.book.pages.map((p) =>
          p.id === pageId ? { ...p, hotspots: [...p.hotspots, hotspot] } : p
        ),
      },
    }
  }),

  /**
   * Everything the detector found, in one step.
   *
   * `addHotspot` snapshots history per call, so accepting 21 detected pins
   * across 24 pages would have cost 21 presses of ⌘Z to undo. The post-import
   * step promises "you can undo the whole thing" — this is what makes that
   * true.
   */
  addHotspotsBatch: (byPage) => set((state) => {
    if (!state.book?.pages) return state
    const found = new Map(byPage.map((entry) => [entry.pageId, entry.hotspots]))
    return {
      isDirty: true,
      ...snapshotHistory(state, state.book),
      book: {
        ...state.book,
        pages: state.book.pages.map((p) => {
          const extra = found.get(p.id)
          return extra?.length ? { ...p, hotspots: [...p.hotspots, ...extra] } : p
        }),
      },
    }
  }),

  updateHotspot: (pageId, hotspotId, updates) => set((state) => {
    if (!state.book?.pages) return state
    return {
      isDirty: true,
      ...coalescedHistory(state, state.book, `hotspot:${hotspotId}`),
      book: {
        ...state.book,
        pages: state.book.pages.map((p) =>
          p.id === pageId
            ? { ...p, hotspots: p.hotspots.map((h) => h.id === hotspotId ? { ...h, ...updates } as Hotspot : h) }
            : p
        ),
      },
    }
  }),

  removeHotspot: (pageId, hotspotId) => set((state) => {
    if (!state.book?.pages) return state
    return {
      isDirty: true,
      selectedHotspotId: null,
      ...snapshotHistory(state, state.book),
      book: {
        ...state.book,
        pages: state.book.pages.map((p) =>
          p.id === pageId ? { ...p, hotspots: p.hotspots.filter((h) => h.id !== hotspotId) } : p
        ),
      },
    }
  }),

  addPage: () => set((state) => {
    if (!state.book) return state
    const pages = state.book.pages ?? []
    const newPage: Page = {
      id: crypto.randomUUID(),
      book_id: state.book.id,
      page_number: pages.length + 1,
      type: 'content',
      layout: 'text',
      blocks: [],
      hotspots: [],
    }
    return {
      isDirty: true,
      ...snapshotHistory(state, state.book),
      book: { ...state.book, pages: [...pages, newPage] },
      currentPageIndex: pages.length,
    }
  }),

  /**
   * Insert a page where the author is, rather than at the end.
   *
   * `addPage` only appends, so adding a page after page 3 of 20 meant appending
   * and then dragging it back seventeen places. This is also what the Layouts
   * tab uses: applying a layout used to overwrite the current page's blocks and
   * apologise in a toast afterwards.
   */
  insertPage: (afterIndex, seed) => set((state) => {
    if (!state.book) return state
    const pages = state.book.pages ?? []
    const at = Math.min(Math.max(afterIndex + 1, 0), pages.length)
    const newPage: Page = {
      id: crypto.randomUUID(),
      book_id: state.book.id,
      page_number: at + 1,
      type: 'content',
      layout: seed?.layout ?? 'text',
      blocks: seed?.blocks ?? [],
      hotspots: [],
    }
    const next = [...pages.slice(0, at), newPage, ...pages.slice(at)]
      .map((p, i) => ({ ...p, page_number: i + 1 }))
    return {
      isDirty: true,
      ...snapshotHistory(state, state.book),
      book: { ...state.book, pages: next },
      currentPageIndex: at,
      selectedBlockId: null,
      selectedHotspotId: null,
    }
  }),

  removePage: (pageId) => set((state) => {
    if (!state.book?.pages || state.book.pages.length <= 1) return state
    const filtered = state.book.pages
      .filter((p) => p.id !== pageId)
      .map((p, i) => ({ ...p, page_number: i + 1 }))
    return {
      isDirty: true,
      ...snapshotHistory(state, state.book),
      currentPageIndex: Math.min(get().currentPageIndex, filtered.length - 1),
      book: { ...state.book, pages: filtered },
    }
  }),

  reorderPages: (fromIndex, toIndex) => set((state) => {
    if (!state.book?.pages) return state
    const pages = [...state.book.pages]
    const [moved] = pages.splice(fromIndex, 1)
    pages.splice(toIndex, 0, moved)
    const renumbered = pages.map((p, i) => ({ ...p, page_number: i + 1 }))
    return {
      isDirty: true,
      ...snapshotHistory(state, state.book),
      currentPageIndex: toIndex,
      book: { ...state.book, pages: renumbered },
    }
  }),

  setPageBlocks: (pageId, blocks) => set((state) => {
    if (!state.book?.pages) return state
    return {
      isDirty: true,
      ...snapshotHistory(state, state.book),
      book: {
        ...state.book,
        pages: state.book.pages.map((p) =>
          p.id === pageId ? { ...p, blocks } : p
        ),
      },
    }
  }),

  undo: () => set((state) => {
    if (state.past.length === 0 || !state.book) return state
    const previous = state.past[state.past.length - 1]
    const newPast = state.past.slice(0, -1)
    return {
      book: previous,
      past: newPast,
      future: [state.book, ...state.future],
      isDirty: true,
      lastEditKey: null,
    }
  }),

  redo: () => set((state) => {
    if (state.future.length === 0 || !state.book) return state
    const next = state.future[0]
    const newFuture = state.future.slice(1)
    return {
      book: next,
      past: pushHistory(state.past, state.book),
      future: newFuture,
      isDirty: true,
      lastEditKey: null,
    }
  }),
}))
