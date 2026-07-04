import { create } from 'zustand'
import type { Book, Page, Block, Hotspot } from './book-schema'

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
  addBlock: (pageId: string, block: Block) => void
  removeBlock: (pageId: string, blockId: string) => void
  moveBlock: (pageId: string, blockId: string, direction: 'up' | 'down') => void

  addHotspot: (pageId: string, hotspot: Hotspot) => void
  updateHotspot: (pageId: string, hotspotId: string, updates: Partial<Hotspot>) => void
  removeHotspot: (pageId: string, hotspotId: string) => void

  addPage: () => void
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
    ...(isNewStep ? { past: [...state.past, book], future: [] } : {}),
  }
}

/** History patch for a structural edit (add/remove/reorder) — always its own undo step. */
function snapshotHistory(state: Pick<EditorStore, 'past'>, book: Book) {
  return { past: [...state.past, book], future: [] }
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
      past: [...state.past, state.book],
      future: newFuture,
      isDirty: true,
      lastEditKey: null,
    }
  }),
}))
