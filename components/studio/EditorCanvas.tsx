'use client'

import { useRef, useState, useCallback, useEffect } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  Plus,
  Crosshair,
  Type,
  Image,
  Video,
  Music,
  MousePointerClick,
  Minus,
  Code2,
  X,
  GripVertical,
  RefreshCw,
  Maximize2,
  Minimize2,
  Grid3X3,
  Loader2,
  ArrowUp,
  ArrowDown,
  Copy,
  Trash2,
  Smartphone,
  Monitor,
  LayoutTemplate,
  ShoppingBag,
  FileText,
  BookOpen,
  Move,
  Rows3,
} from 'lucide-react'
import { toast } from 'sonner'
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
  horizontalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEditorStore } from '@/lib/editor-store'
import { trackProduct } from '@/lib/product-analytics'
import { PageRenderer, defaultFrame } from '@/components/viewer/PageRenderer'
import { InsertPanel } from '@/components/studio/InsertPanel'
import type { Block, Book, Page, Frame } from '@/lib/book-schema'
import type { PageTemplate } from '@/lib/templates'
import { PAGE_DESIGN_WIDTH, PAGE_RATIO, ZOOM_STEPS, pageSideFor, spreadFor } from '@/lib/page-geometry'

// ─── Sortable Block Wrapper ───────────────────────────────────────────────────

function SortableBlock({
  id,
  label,
  isSelected,
  isAnchor,
  canMoveUp,
  canMoveDown,
  onMoveUp,
  onMoveDown,
  onDuplicate,
  onDelete,
  onInsertAfter,
  onClick,
  onCanvasDragStart,
  children,
}: {
  id: string
  /** Block type, surfaced on the selection so it's clear what's being edited. */
  label: string
  isSelected: boolean
  /** The one the settings panel is editing, when several are selected. */
  isAnchor: boolean
  canMoveUp?: boolean
  canMoveDown?: boolean
  onMoveUp?: () => void
  onMoveDown?: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  onInsertAfter?: () => void
  /** Set on a canvas page: the handle moves the block rather than reordering it. */
  onCanvasDragStart?: (e: React.PointerEvent) => void
  onClick: (e: React.MouseEvent) => void
  children: React.ReactNode
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-block-id={id}
      onClick={onClick}
      className={twMerge(
        'relative group/block transition-all outline-none rounded-lg',
        isSelected
          ? isAnchor
            ? 'ring-2 ring-[var(--studio-select)] shadow-md'
            : 'ring-2 ring-[var(--studio-select)]/50'
          : 'hover:ring-1 hover:ring-neutral-400',
        isDragging && 'opacity-40 z-50 ring-2 ring-[var(--studio-select)] shadow-2xl scale-[1.01]',
        !isSelected && 'cursor-pointer'
      )}
    >
      {/* In-Canvas Floating Action Bar */}
      <div
        className={twMerge(
          'absolute -top-3.5 left-2 z-50 flex items-center gap-0.5 rounded-full bg-neutral-900 px-1.5 py-0.5 text-white shadow-xl border border-neutral-700 transition-all select-none',
          isAnchor
            ? 'opacity-100 scale-100'
            : 'opacity-0 scale-95 pointer-events-none group-hover/block:opacity-100 group-hover/block:scale-100 group-hover/block:pointer-events-auto'
        )}
      >
        {/* Drag handle. On a flow page it reorders; on a canvas page it moves. */}
        <div
          {...(onCanvasDragStart ? {} : listeners)}
          {...(onCanvasDragStart ? {} : attributes)}
          onPointerDown={onCanvasDragStart}
          tabIndex={0}
          aria-label={onCanvasDragStart ? 'Drag to move block' : 'Drag to reorder block'}
          title={onCanvasDragStart ? 'Drag to move — hold shift to ignore snapping' : 'Drag to reorder block'}
          className="flex h-5 w-5 items-center justify-center rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800 cursor-grab active:cursor-grabbing"
        >
          <GripVertical size={12} />
        </div>

        <span className="h-3 w-px bg-neutral-700 mx-0.5" />

        {/* Move Up */}
        <button
          type="button"
          disabled={!canMoveUp}
          onClick={(e) => {
            e.stopPropagation()
            onMoveUp?.()
          }}
          title="Move block up"
          className="flex h-5 w-5 items-center justify-center rounded-full text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ArrowUp size={11} />
        </button>

        {/* Move Down */}
        <button
          type="button"
          disabled={!canMoveDown}
          onClick={(e) => {
            e.stopPropagation()
            onMoveDown?.()
          }}
          title="Move block down"
          className="flex h-5 w-5 items-center justify-center rounded-full text-neutral-300 hover:text-white hover:bg-neutral-800 disabled:opacity-30 disabled:hover:bg-transparent"
        >
          <ArrowDown size={11} />
        </button>

        <span className="h-3 w-px bg-neutral-700 mx-0.5" />

        {/* Duplicate */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDuplicate?.()
          }}
          title="Duplicate block"
          className="flex h-5 w-5 items-center justify-center rounded-full text-neutral-300 hover:text-white hover:bg-neutral-800"
        >
          <Copy size={11} />
        </button>

        {/* Delete */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onDelete?.()
          }}
          title="Delete block"
          className="flex h-5 w-5 items-center justify-center rounded-full text-red-400 hover:text-red-300 hover:bg-red-950/50"
        >
          <Trash2 size={11} />
        </button>

        <span className="h-3 w-px bg-neutral-700 mx-0.5" />

        {/* Block Type Badge */}
        <span className="px-1 text-[9px] font-bold uppercase tracking-wider text-[var(--studio-select)]">
          {label}
        </span>
      </div>

      <div className={twMerge(isSelected ? 'pointer-events-auto' : 'pointer-events-none')}>
        {children}
      </div>

      {/* Quick Add Block Below divider button */}
      <div className="relative -bottom-2.5 z-40 flex justify-center opacity-0 group-hover/block:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation()
            onInsertAfter?.()
          }}
          title="Insert block below"
          className="flex items-center gap-1 rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-semibold text-neutral-300 shadow-md border border-neutral-700 hover:bg-[var(--studio-select)] hover:text-white hover:border-transparent transition-all scale-90 hover:scale-100"
        >
          <Plus size={10} strokeWidth={2.5} />
          Add below
        </button>
      </div>
    </div>
  )
}

// ─── Editor Canvas ────────────────────────────────────────────────────────────

export function EditorCanvas() {
  const {
    book,
    currentPageIndex,
    hotspotMode,
    selectedBlockId,
    selectedHotspotId,
    setHotspotMode,
    selectBlock,
    selectedBlockIds,
    toggleBlockSelection,
    addBlock,
    insertBlockAt,
    duplicateBlock,
    removeBlock,
    moveBlock,
    addHotspot,
    updateHotspot,
  } = useEditorStore()

  const [showBlockPicker, setShowBlockPicker] = useState(false)
  const [insertIndex, setInsertIndex] = useState<number | null>(null)
  const [showGuides, setShowGuides] = useState(false)
  const [isDetecting, setIsDetecting] = useState(false)
  const [viewportMode, setViewportMode] = useState<'desktop' | 'mobile'>('desktop')
  /**
   * Page or spread.
   *
   * The reader shows two facing pages on anything wider than a phone
   * (`usePortrait={isMobile}` in ViewerEngine) while the editor only ever
   * showed one, so an author composing page 12 never saw page 13, never saw
   * the gutter, and could not tell which of their pages face each other.
   */
  const [viewMode, setViewMode] = useState<'page' | 'spread'>('page')
  const [cursorCoords, setCursorCoords] = useState<{ x: number; y: number } | null>(null)
  const [zoom, setZoom] = useState(1)
  const canvasRef = useRef<HTMLDivElement>(null)

  const currentPage = book?.pages?.[currentPageIndex]

  const handleAutoDetect = async () => {
    if (!currentPage) return
    setIsDetecting(true)
    try {
      const res = await fetch('/api/ai/detect-hotspots', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ page: currentPage }),
      })
      const data = await res.json()
      if (res.ok && data.detected?.length > 0) {
        for (const spot of data.detected) {
          addHotspot(currentPage.id, spot)
        }
        toast.success(`Auto-detected ${data.detected.length} interactive pin${data.detected.length === 1 ? '' : 's'}`)
      } else {
        toast.info('No new product callouts detected on this page.')
      }
    } catch {
      toast.error('Failed to run AI hotspot detection.')
    } finally {
      setIsDetecting(false)
    }
  }

  const zoomIndex = ZOOM_STEPS.indexOf(zoom)
  const prevStep = ZOOM_STEPS[Math.max(0, (zoomIndex === -1 ? 2 : zoomIndex) - 1)]
  const nextStep = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, (zoomIndex === -1 ? 2 : zoomIndex) + 1)]
  const isMobile = viewportMode === 'mobile'
  const pageWidth = isMobile ? 380 : Math.round(PAGE_DESIGN_WIDTH * zoom)
  const pageHeight = isMobile ? 740 : Math.round(pageWidth * PAGE_RATIO)

  // A phone reader gets one page at a time, so a spread there would be a lie.
  const spreadView = viewMode === 'spread' && !isMobile
  const pages = book?.pages ?? []
  const spread = spreadFor(currentPageIndex, pages.length)
  const facingIndex = spreadView
    ? spread.left === currentPageIndex
      ? spread.right
      : spread.left
    : null
  const facingPage = facingIndex != null ? pages[facingIndex] : null
  /** Which side the *current* page sits on, so the facing one goes opposite. */
  const currentSide = pageSideFor(currentPageIndex, false)

  /**
   * Place a hotspot at a percentage position on the page.
   *
   * Split out of the click handler so the keyboard has a way in. Hotspots are
   * the interactive feature the product leads with, and creating one used to be
   * possible only by arming a toggle and then clicking an x/y coordinate — no
   * keyboard path existed at all.
   */
  const placeHotspot = useCallback(
    (x: number, y: number) => {
      if (!currentPage) return
      const isFirst = (currentPage.hotspots?.length ?? 0) === 0
      const newHotspotId = crypto.randomUUID()
      addHotspot(currentPage.id, {
        id: newHotspotId,
        x: Math.min(100, Math.max(0, Math.round(x * 10) / 10)),
        y: Math.min(100, Math.max(0, Math.round(y * 10) / 10)),
        label: 'New hotspot',
        icon: 'Info',
        action: 'modal',
        modal: { title: 'New hotspot', body: '' },
      })
      useEditorStore.getState().selectHotspot(newHotspotId)
      useEditorStore.getState().setHotspotMode(false)
      // Enrichment is the leading indicator of upgrade intent — an author who
      // adds a hotspot is using the edition as something other than a PDF.
      if (isFirst) trackProduct('edition_enriched', { kind: 'hotspot' })
    },
    [currentPage, addHotspot]
  )

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!hotspotMode || !currentPage || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      placeHotspot(x, y)
    },
    [hotspotMode, currentPage, placeHotspot]
  )

  /**
   * Keyboard equivalent of clicking the page: with hotspot mode armed, Enter or
   * Space drops one in the middle of the page. Arrow keys then nudge whichever
   * hotspot is selected — 1% a press, 10% with Shift — which is also the only
   * way to position one precisely, since the inspector shows X/Y read-only.
   */
  const handleCanvasKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      if (!currentPage) return

      if (hotspotMode && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault()
        placeHotspot(50, 50)
        return
      }

      const nudge = e.shiftKey ? 10 : 1
      const delta =
        e.key === 'ArrowLeft'
          ? { x: -nudge, y: 0 }
          : e.key === 'ArrowRight'
            ? { x: nudge, y: 0 }
            : e.key === 'ArrowUp'
              ? { x: 0, y: -nudge }
              : e.key === 'ArrowDown'
                ? { x: 0, y: nudge }
                : null

      // On a canvas page a selected block nudges the same way a hotspot does —
      // the only precise way to place either, since the inspector shows no
      // coordinate fields.
      if (delta && selectedBlockId && currentPage.layout === 'canvas') {
        const block = currentPage.blocks.find((b) => b.id === selectedBlockId)
        if (block) {
          e.preventDefault()
          const frame =
            block.frame ?? defaultFrame(currentPage.blocks.findIndex((b) => b.id === selectedBlockId))
          useEditorStore.getState().setBlockFrame(currentPage.id, selectedBlockId, {
            ...frame,
            x: Math.min(100 - frame.w, Math.max(0, Math.round((frame.x + delta.x) * 10) / 10)),
            y: Math.min(96, Math.max(0, Math.round((frame.y + delta.y) * 10) / 10)),
          })
          return
        }
      }

      if (!delta || !selectedHotspotId) return
      const hotspot = currentPage.hotspots?.find((h) => h.id === selectedHotspotId)
      if (!hotspot) return

      e.preventDefault()
      updateHotspot(currentPage.id, selectedHotspotId, {
        x: Math.min(100, Math.max(0, Math.round((hotspot.x + delta.x) * 10) / 10)),
        y: Math.min(100, Math.max(0, Math.round((hotspot.y + delta.y) * 10) / 10)),
      })
    },
    [hotspotMode, currentPage, selectedHotspotId, selectedBlockId, placeHotspot, updateHotspot]
  )

  /**
   * Flow ⇄ canvas.
   *
   * Going to canvas, the blocks' current positions are measured off the live
   * flow layout first and handed over as the seed. A frame derived from index
   * alone cannot know that a heading is 40px and a pull quote 200px, so it
   * overlaps them — and an author whose page rearranges itself the moment they
   * switch will not switch again.
   */
  const switchLayoutMode = useCallback(
    (mode: 'flow' | 'canvas') => {
      if (!currentPage) return
      if (mode !== 'canvas') {
        useEditorStore.getState().setPageLayoutMode(currentPage.id, 'text')
        return
      }

      const host = canvasRef.current
      const seed: Record<string, Frame> = {}
      if (host) {
        const page = host.getBoundingClientRect()
        currentPage.blocks.forEach((block, i) => {
          const el = host.querySelector<HTMLElement>(`[data-block-id="${block.id}"]`)
          if (!el) return
          const r = el.getBoundingClientRect()
          seed[block.id] = {
            x: Math.round(((r.left - page.left) / page.width) * 1000) / 10,
            y: Math.round(((r.top - page.top) / page.height) * 1000) / 10,
            w: Math.round(((r.width / page.width) * 1000)) / 10,
            z: i,
          }
        })
      }
      useEditorStore.getState().setPageLayoutMode(currentPage.id, 'canvas', seed)
      toast.success('Canvas layout — drag any block to place it. Phones still stack.')
    },
    [currentPage]
  )

  const isCanvasPage = currentPage?.layout === 'canvas'
  const [draggingBlockId, setDraggingBlockId] = useState<string | null>(null)
  const [snapLines, setSnapLines] = useState<{ v: number[]; h: number[] }>({ v: [], h: [] })

  /**
   * Drag a block to position it, on a canvas page.
   *
   * Snaps to the page margin, the centre line and the edges of its siblings at
   * a 1.5% tolerance — the guides the canvas already drew but that nothing
   * attracted to. The lines that actually caught are drawn while dragging, so
   * a snap is visible rather than merely felt.
   */
  const beginBlockDrag = useCallback(
    (e: React.PointerEvent, blockId: string) => {
      if (!currentPage || !canvasRef.current) return
      const block = currentPage.blocks.find((b) => b.id === blockId)
      if (!block) return
      const start = block.frame ?? defaultFrame(currentPage.blocks.findIndex((b) => b.id === blockId))
      const rect = canvasRef.current.getBoundingClientRect()
      const target = e.currentTarget as HTMLElement
      const originX = e.clientX
      const originY = e.clientY

      // Every edge a sibling offers, plus the margin and the centre.
      const others = currentPage.blocks
        .filter((b) => b.id !== blockId)
        .map((b, i) => b.frame ?? defaultFrame(i))
      const vTargets = [8, 92 - start.w, (100 - start.w) / 2, ...others.map((f) => f.x), ...others.map((f) => f.x + f.w - start.w)]
      const hTargets = [8, ...others.map((f) => f.y)]

      const SNAP = 1.5
      const nearest = (value: number, targets: number[]) => {
        let best: number | null = null
        for (const t of targets) {
          if (Math.abs(value - t) <= SNAP && (best === null || Math.abs(value - t) < Math.abs(value - best))) {
            best = t
          }
        }
        return best
      }

      const onMove = (ev: PointerEvent) => {
        setDraggingBlockId(blockId)
        const dx = ((ev.clientX - originX) / rect.width) * 100
        const dy = ((ev.clientY - originY) / rect.height) * 100
        let x = Math.min(100 - start.w, Math.max(0, start.x + dx))
        let y = Math.min(96, Math.max(0, start.y + dy))

        const snapX = ev.shiftKey ? null : nearest(x, vTargets)
        const snapY = ev.shiftKey ? null : nearest(y, hTargets)
        if (snapX !== null) x = snapX
        if (snapY !== null) y = snapY

        setSnapLines({ v: snapX !== null ? [x] : [], h: snapY !== null ? [y] : [] })
        useEditorStore.getState().setBlockFrame(currentPage.id, blockId, {
          ...start,
          x: Math.round(x * 10) / 10,
          y: Math.round(y * 10) / 10,
        })
      }

      const onUp = () => {
        setDraggingBlockId(null)
        setSnapLines({ v: [], h: [] })
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onUp)
        target.removeEventListener('pointercancel', onUp)
      }

      target.setPointerCapture(e.pointerId)
      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onUp)
      target.addEventListener('pointercancel', onUp)
      useEditorStore.getState().selectBlock(blockId)
    },
    [currentPage]
  )

  const [draggingHotspotId, setDraggingHotspotId] = useState<string | null>(null)

  /**
   * Drag a hotspot to move it.
   *
   * A hotspot is the only thing on a page with real coordinates, and until now
   * the only way to change them was to select the marker and hold an arrow key —
   * the inspector renders X/Y read-only. Pointer capture keeps the drag alive
   * when the cursor leaves the 5px marker, which is most of the time.
   */
  const beginHotspotDrag = useCallback(
    (e: React.PointerEvent, hotspotId: string) => {
      if (!currentPage || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const target = e.currentTarget as HTMLElement
      let moved = false

      const onMove = (ev: PointerEvent) => {
        if (!moved) {
          moved = true
          setDraggingHotspotId(hotspotId)
        }
        updateHotspot(currentPage.id, hotspotId, {
          x: Math.min(100, Math.max(0, Math.round(((ev.clientX - rect.left) / rect.width) * 1000) / 10)),
          y: Math.min(100, Math.max(0, Math.round(((ev.clientY - rect.top) / rect.height) * 1000) / 10)),
        })
      }
      const onUp = () => {
        setDraggingHotspotId(null)
        target.removeEventListener('pointermove', onMove)
        target.removeEventListener('pointerup', onUp)
        target.removeEventListener('pointercancel', onUp)
      }

      target.setPointerCapture(e.pointerId)
      target.addEventListener('pointermove', onMove)
      target.addEventListener('pointerup', onUp)
      target.addEventListener('pointercancel', onUp)
    },
    [currentPage, updateHotspot]
  )

  const handleInsertBlock = useCallback(
    (newBlock: Block) => {
      if (!currentPage) return
      if (insertIndex !== null) {
        insertBlockAt(currentPage.id, newBlock, insertIndex)
        setInsertIndex(null)
      } else {
        addBlock(currentPage.id, newBlock)
      }
      useEditorStore.getState().selectBlock(newBlock.id)
      setShowBlockPicker(false)
    },
    [currentPage, addBlock, insertBlockAt, insertIndex]
  )

  /**
   * A layout adds a page. It used to call `setPageBlocks` on the page the author
   * was looking at — destroying their work and apologising in a toast afterwards.
   */
  const handleInsertLayout = useCallback(
    (tpl: PageTemplate) => {
      const index = useEditorStore.getState().currentPageIndex
      useEditorStore.getState().insertPage(index, {
        layout: tpl.layout,
        blocks: tpl.blocks.map((b) => ({ ...b, id: crypto.randomUUID() })) as Block[],
      })
      setInsertIndex(null)
      setShowBlockPicker(false)
      toast.success(`Added “${tpl.label}” as page ${index + 2} — your page is untouched`)
    },
    []
  )

  /**
   * The command palette's two formerly-dead actions land here.
   *
   * `onToggleGuides` and `onAutoDetectPins` were both passed as `() => {}` —
   * the state they need lives in this component, and rather than lift it just
   * for the palette, the palette asks and the canvas answers.
   */
  useEffect(() => {
    const guides = () => setShowGuides((v) => !v)
    const detect = () => { void handleAutoDetect() }
    window.addEventListener('qlico:toggle-guides', guides)
    window.addEventListener('qlico:detect-pins', detect)
    return () => {
      window.removeEventListener('qlico:toggle-guides', guides)
      window.removeEventListener('qlico:detect-pins', detect)
    }
  })

  /**
   * `/` opens the insert panel — the second of its two entry points, the other
   * being the `+` between blocks. Handled here rather than in EditorClient
   * because the panel's open state lives with the canvas that owns the page.
   */
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key !== '/' || e.metaKey || e.ctrlKey || e.altKey) return
      const el = e.target as HTMLElement | null
      if (el?.isContentEditable) return
      if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
      if (showBlockPicker) return
      e.preventDefault()
      setInsertIndex(null)
      setShowBlockPicker(true)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [showBlockPicker])

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 3 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id || !currentPage) return
    const fromIndex = currentPage.blocks.findIndex((b) => b.id === active.id)
    const toIndex = currentPage.blocks.findIndex((b) => b.id === over.id)
    if (fromIndex !== -1 && toIndex !== -1) {
      // Reorder locally using existing or new store action. 
      // Wait, we need to reorder blocks! The store has `setPageBlocks`.
      const newBlocks = [...currentPage.blocks]
      const [moved] = newBlocks.splice(fromIndex, 1)
      newBlocks.splice(toIndex, 0, moved)
      useEditorStore.getState().setPageBlocks(currentPage.id, newBlocks)
    }
  }

  if (!book || !currentPage) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm">
        No page selected
      </div>
    )
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-neutral-900">
      {/* Canvas toolbar */}
      <div className="flex h-11 shrink-0 items-center gap-2 border-b border-neutral-800 px-3">
        <span className="flex items-center gap-2 text-xs text-neutral-400">
          <span className="font-medium text-neutral-200">Page {currentPage.page_number}</span>
          <span className="text-neutral-600">/</span>
          <span className="capitalize">{currentPage.layout}</span>
        </span>

        <div className="flex-1" />

        {/* Viewport Mode Switcher: Desktop vs Mobile */}
        <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-950/60 p-0.5">
          <button
            onClick={() => setViewportMode('desktop')}
            aria-pressed={viewportMode === 'desktop'}
            title="Desktop / iPad Spread View"
            className={twMerge(
              'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition',
              viewportMode === 'desktop'
                ? 'bg-neutral-800 text-white font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            )}
          >
            <Monitor size={13} />
            <span className="hidden sm:inline">Desktop</span>
          </button>
          <button
            onClick={() => setViewportMode('mobile')}
            aria-pressed={viewportMode === 'mobile'}
            title="Mobile iPhone Viewport Simulation"
            className={twMerge(
              'flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition',
              viewportMode === 'mobile'
                ? 'bg-neutral-800 text-white font-semibold shadow-sm'
                : 'text-neutral-400 hover:text-neutral-200'
            )}
          >
            <Smartphone size={13} />
            <span className="hidden sm:inline">Mobile</span>
          </button>
        </div>

        {/* Flow or canvas. The canvas the editor draws — paper shadow, zoom,
            guides, a live X/Y readout — promised free composition while blocks
            rendered into a flex column with no position at all. This is the
            page saying which of the two it actually is. */}
        {!isMobile && currentPage && (
          <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-950/60 p-0.5">
            {(['flow', 'canvas'] as const).map((mode) => {
              const active = mode === 'canvas' ? isCanvasPage : !isCanvasPage
              return (
                <button
                  key={mode}
                  onClick={() => switchLayoutMode(mode)}
                  aria-pressed={active}
                  title={
                    mode === 'canvas'
                      ? 'Place blocks anywhere — stacks in order on a phone'
                      : 'Blocks stack in order and reflow everywhere'
                  }
                  className={twMerge(
                    'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium capitalize transition',
                    active
                      ? 'bg-neutral-800 font-semibold text-white shadow-sm'
                      : 'text-neutral-400 hover:text-neutral-200'
                  )}
                >
                  {mode === 'canvas' ? <Move size={13} /> : <Rows3 size={13} />}
                  <span className="hidden sm:inline">{mode}</span>
                </button>
              )
            })}
          </div>
        )}

        {/* Page or spread. Sits beside the viewport switch because they answer
            the same question — what am I looking at — and the reader's own
            answer depends on both. */}
        {!isMobile && (
          <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-950/60 p-0.5">
            <button
              onClick={() => setViewMode('page')}
              aria-pressed={viewMode === 'page'}
              title="One page at a time"
              className={twMerge(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition',
                viewMode === 'page'
                  ? 'bg-neutral-800 font-semibold text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              )}
            >
              <FileText size={13} />
              <span className="hidden sm:inline">Page</span>
            </button>
            <button
              onClick={() => {
                setViewMode('spread')
                // Two pages need roughly twice the width; dropping the zoom
                // means the spread arrives whole instead of half off-screen.
                setZoom((z) => Math.min(z, 0.75))
              }}
              aria-pressed={viewMode === 'spread'}
              title="Both facing pages, as a reader sees them"
              className={twMerge(
                'flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium transition',
                viewMode === 'spread'
                  ? 'bg-neutral-800 font-semibold text-white shadow-sm'
                  : 'text-neutral-400 hover:text-neutral-200'
              )}
            >
              <BookOpen size={13} />
              <span className="hidden sm:inline">Spread</span>
            </button>
          </div>
        )}

        {/* Zoom (Desktop only) */}
        {!isMobile && (
          <div className="flex items-center rounded-lg border border-neutral-800 bg-neutral-950/60 p-0.5">
            <button
              onClick={() => setZoom(prevStep)}
              disabled={zoom <= ZOOM_STEPS[0]}
              aria-label="Zoom out"
              className="grid h-7 w-7 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Minimize2 size={13} />
            </button>
            <button
              onClick={() => setZoom(1)}
              aria-label={`Zoom ${Math.round(zoom * 100)} percent — reset to 100 percent`}
              className="min-w-[46px] rounded-md px-1 py-1 text-[11px] font-semibold tabular-nums text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-neutral-100"
            >
              {Math.round(zoom * 100)}%
            </button>
            <button
              onClick={() => setZoom(nextStep)}
              disabled={zoom >= ZOOM_STEPS[ZOOM_STEPS.length - 1]}
              aria-label="Zoom in"
              className="grid h-7 w-7 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Maximize2 size={13} />
            </button>
          </div>
        )}

        {/* Alignment Guidelines Toggle */}
        <button
          onClick={() => setShowGuides((v) => !v)}
          aria-pressed={showGuides}
          title={showGuides ? 'Hide alignment guidelines' : 'Show alignment guidelines'}
          className={twMerge(
            'grid h-8 w-8 place-items-center rounded-lg border text-xs transition-colors',
            showGuides
              ? 'border-cyan-500/60 bg-cyan-500/10 text-cyan-400'
              : 'border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-neutral-100'
          )}
        >
          <Grid3X3 size={14} />
        </button>

        <span className="h-5 w-px bg-neutral-800" aria-hidden="true" />

        <button
          onClick={() => setHotspotMode(!hotspotMode)}
          aria-pressed={hotspotMode}
          className={twMerge(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-semibold transition-colors',
            hotspotMode
              ? 'bg-amber-400 text-amber-950 font-bold border border-amber-500 shadow-md'
              : 'border border-neutral-700 bg-neutral-900 text-neutral-200 hover:bg-neutral-800 hover:text-white'
          )}
        >
          <Crosshair size={13} />
          {hotspotMode ? 'Click page to place pin' : 'Add hotspot'}
        </button>

        {/* AI Hotspot Detector */}
        <button
          type="button"
          onClick={handleAutoDetect}
          disabled={isDetecting}
          title="Auto-detect interactive product pins"
          className="flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-900 px-2.5 py-1.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-40"
        >
          {isDetecting ? (
            <Loader2 size={13} className="animate-spin text-neutral-400" />
          ) : (
            <Crosshair size={13} className="text-neutral-400" />
          )}
          {isDetecting ? 'Detecting…' : 'Auto-detect pins'}
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto bg-[radial-gradient(#232323_1px,transparent_1px)] p-8 [background-size:22px_22px] flex items-center justify-center">
        {/* Mobile Device Bezel Frame if in mobile mode */}
        <div className={twMerge('transition-all duration-300', isMobile && 'p-3 bg-neutral-950 rounded-[44px] border-[6px] border-neutral-800 shadow-[0_25px_60px_-15px_rgba(0,0,0,0.9)] ring-1 ring-neutral-700/50')}>
          {isMobile && (
            <div className="w-24 h-4 bg-neutral-800 rounded-full mx-auto mb-2 flex items-center justify-center">
              <span className="w-2.5 h-2.5 bg-neutral-900 rounded-full" />
            </div>
          )}

          {/* The spread. In page view this is a row of one, so the editable
              page below is identical either way — only its neighbour appears. */}
          <div className="flex items-start justify-center">
          {spreadView && facingPage && currentSide === 'right' && (
            <FacingPage
              page={facingPage}
              index={facingIndex!}
              bookId={book.id}
              theme={book.theme}
              width={pageWidth}
              height={pageHeight}
              side="left"
            />
          )}

          <div
            ref={canvasRef}
            style={{ width: pageWidth, height: pageHeight }}
            className={twMerge(
              'relative overflow-hidden rounded-[3px] bg-white transition-all',
              !spreadView && 'mx-auto',
              isMobile ? 'rounded-[32px]' : 'shadow-[0_1px_2px_rgba(0,0,0,0.35),0_12px_28px_-8px_rgba(0,0,0,0.55),0_40px_80px_-32px_rgba(0,0,0,0.7)] ring-1 ring-black/40',
              hotspotMode && 'cursor-crosshair ring-2 ring-amber-400/70'
            )}
            onClick={handleCanvasClick}
            onMouseMove={(e) => {
              if (!hotspotMode || !canvasRef.current) return
              const rect = canvasRef.current.getBoundingClientRect()
              setCursorCoords({
                x: Math.round(((e.clientX - rect.left) / rect.width) * 1000) / 10,
                y: Math.round(((e.clientY - rect.top) / rect.height) * 1000) / 10,
              })
            }}
            onMouseLeave={() => setCursorCoords(null)}
            onKeyDown={handleCanvasKeyDown}
            tabIndex={hotspotMode || selectedHotspotId || (isCanvasPage && selectedBlockId) ? 0 : -1}
            role={hotspotMode ? 'application' : undefined}
          >
            {/* The lines that actually caught, so a snap is seen and not just
                felt. Drawn above the page, cleared when the drag ends. */}
            {draggingBlockId && (snapLines.v.length > 0 || snapLines.h.length > 0) && (
              <div className="pointer-events-none absolute inset-0 z-40">
                {snapLines.v.map((x) => (
                  <div
                    key={`v${x}`}
                    className="absolute inset-y-0 w-px bg-[var(--studio-select)]"
                    style={{ left: `${x}%` }}
                  />
                ))}
                {snapLines.h.map((y) => (
                  <div
                    key={`h${y}`}
                    className="absolute inset-x-0 h-px bg-[var(--studio-select)]"
                    style={{ top: `${y}%` }}
                  />
                ))}
              </div>
            )}

            {/* Non-printing alignment guidelines */}
            {showGuides && (
              <div className="pointer-events-none absolute inset-0 z-30">
                <div className="absolute inset-6 rounded border border-dashed border-cyan-500/40" />
                <div className="absolute inset-y-0 left-1/2 w-px border-l border-dashed border-cyan-500/50" />
                <div className="absolute inset-x-0 top-1/2 h-px border-t border-dashed border-cyan-500/50" />
              </div>
            )}

            {/* Precision Hotspot Crosshair Coordinates Badge */}
            {hotspotMode && (
              <div className="pointer-events-none absolute inset-x-0 top-3 z-30 flex flex-col items-center gap-1">
                <p className="rounded-full bg-amber-400 px-3 py-1 text-[11px] font-bold text-amber-950 shadow-xl border border-amber-300">
                  🎯 Click anywhere to drop beacon
                </p>
                {cursorCoords && (
                  <span className="rounded bg-neutral-950/80 px-2 py-0.5 text-[10px] font-mono text-amber-300 shadow-md">
                    X: {cursorCoords.x}% · Y: {cursorCoords.y}%
                  </span>
                )}
              </div>
            )}

            {/* An empty page offers exactly one thing, and it is the same
                thing `/` and `+` offer. There used to be three hardcoded
                scaffolds here with luxury-fashion copy baked in, plus a link to
                a fourth surface. */}
            {currentPage.blocks.length === 0 && !hotspotMode && (
              <div className="absolute inset-4 z-20 flex flex-col items-center justify-center p-6 text-center">
                <div className="mb-3 grid h-12 w-12 place-items-center rounded-2xl border border-neutral-800 bg-neutral-900 text-[var(--studio-select)] shadow-md">
                  <LayoutTemplate size={22} />
                </div>
                <h3 className="text-sm font-semibold text-neutral-200">This page is empty</h3>
                <p className="mt-1 mb-5 max-w-xs text-xs text-neutral-400">
                  Add a block, or start from a layout.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setInsertIndex(null)
                    setShowBlockPicker(true)
                  }}
                  className="flex items-center gap-2 rounded-full bg-white px-5 py-2 text-xs font-bold text-black shadow-lg transition-transform hover:scale-105"
                >
                  <Plus size={14} strokeWidth={2.5} />
                  Insert
                  <kbd className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold">/</kbd>
                </button>
              </div>
            )}

          <div className={twMerge('absolute inset-0', hotspotMode && 'pointer-events-none')}>
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={currentPage.blocks.map(b => b.id)}
                strategy={currentPage.layout === 'split' ? horizontalListSortingStrategy : verticalListSortingStrategy}
              >
                <PageRenderer 
                  page={currentPage} 
                  bookId={book.id} 
                  theme={book.theme} 
                  className="w-full h-full"
                  renderBlockWrapper={(block, children) => {
                    const blockIndex = currentPage.blocks.findIndex((b) => b.id === block.id)
                    return (
                      <SortableBlock
                        key={block.id}
                        id={block.id}
                        label={block.type === 'text' ? (block.variant ?? 'text') : block.type}
                        isSelected={selectedBlockIds.includes(block.id)}
                        isAnchor={selectedBlockId === block.id}
                        canMoveUp={blockIndex > 0}
                        canMoveDown={blockIndex < currentPage.blocks.length - 1}
                        onMoveUp={() => moveBlock(currentPage.id, block.id, 'up')}
                        onMoveDown={() => moveBlock(currentPage.id, block.id, 'down')}
                        onDuplicate={() => duplicateBlock(currentPage.id, block.id)}
                        onDelete={() => removeBlock(currentPage.id, block.id)}
                        onCanvasDragStart={
                          isCanvasPage ? (e) => beginBlockDrag(e, block.id) : undefined
                        }
                        onInsertAfter={() => {
                          setInsertIndex(blockIndex + 1)
                          setShowBlockPicker(true)
                        }}
                        onClick={(e) => {
                          e.stopPropagation()
                          // Shift or meta extends the selection; a plain click
                          // replaces it, which is what every other canvas does.
                          if (e.shiftKey || e.metaKey || e.ctrlKey) toggleBlockSelection(block.id)
                          else selectBlock(block.id)
                        }}
                      >
                        {children}
                      </SortableBlock>
                    )
                  }}
                />
              </SortableContext>
            </DndContext>
          </div>

          {/* Hotspot markers */}
          {!hotspotMode &&
            (currentPage.hotspots ?? []).map((hotspot) => (
              <div
                key={hotspot.id}
                className="absolute group z-30"
                style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
              >
                <button
                  onPointerDown={(e) => {
                    e.stopPropagation()
                    useEditorStore.getState().selectHotspot(hotspot.id)
                    beginHotspotDrag(e, hotspot.id)
                  }}
                  className={twMerge(
                    'h-5 w-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-white shadow-md transition-transform hover:scale-110',
                    draggingHotspotId === hotspot.id
                      ? 'scale-110 cursor-grabbing bg-white ring-2 ring-amber-400'
                      : selectedHotspotId === hotspot.id
                        ? 'cursor-grab bg-white ring-2 ring-amber-400'
                        : 'cursor-grab bg-amber-400'
                  )}
                  title={`${hotspot.label} — drag to move, arrow keys to nudge`}
                  aria-label={`Hotspot: ${hotspot.label || 'untitled'}. Drag to move.`}
                />
                
                {/* Hover Peek */}
                <div className="absolute left-1/2 bottom-full mb-3 -translate-x-1/2 w-48 p-3 bg-neutral-900 text-white rounded-lg shadow-xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all origin-bottom z-40">
                  <div className="text-xs font-bold mb-1 truncate">{hotspot.modal?.title || hotspot.label || 'Untitled Hotspot'}</div>
                  <div className="text-[10px] text-neutral-400 line-clamp-2">{hotspot.modal?.body || 'No description provided.'}</div>
                  {/* Triangle pointer */}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />
                </div>
              </div>
            ))}

          {hotspotMode &&
            (currentPage.hotspots ?? []).map((hotspot) => (
              <div
                key={hotspot.id}
                className="absolute w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
              />
            ))}
        </div>

          {spreadView && facingPage && currentSide !== 'right' && (
            <FacingPage
              page={facingPage}
              index={facingIndex!}
              bookId={book.id}
              theme={book.theme}
              width={pageWidth}
              height={pageHeight}
              side="right"
            />
          )}

          {/* A cover, or a last page with nothing opposite it, is a half spread
              in the reader too — showing the empty half is the honest thing. */}
          {spreadView && !facingPage && (
            <div
              style={{ width: pageWidth, height: pageHeight }}
              className={twMerge(
                'grid place-items-center rounded-[3px] border border-dashed border-neutral-800 bg-neutral-950/40 text-center',
                currentSide === 'right' ? 'order-first' : ''
              )}
            >
              <p className="max-w-[70%] text-[11px] leading-4 text-neutral-600">
                {currentPageIndex === 0
                  ? 'The cover stands alone — readers see it by itself before the first spread.'
                  : 'Nothing faces this page yet. Add one and it will pair up here.'}
              </p>
            </div>
          )}
          </div>
        </div>
      </div>

      {/* Add block */}
      <div className="flex shrink-0 justify-center border-t border-neutral-800 px-4 py-3">
        <button
          onClick={() => {
            setInsertIndex(null)
            setShowBlockPicker(true)
          }}
          title="Insert a block or a layout (/)"
          className="flex items-center gap-2 rounded-full bg-white px-6 py-2 text-xs font-bold text-black shadow-lg transition-all hover:scale-105 hover:bg-neutral-200 active:scale-98"
        >
          <Plus size={14} strokeWidth={2.5} />
          Insert
          <kbd className="rounded bg-black/10 px-1.5 py-0.5 text-[10px] font-semibold">/</kbd>
        </button>
      </div>

      {showBlockPicker && (
        <InsertPanel
          onInsertBlock={handleInsertBlock}
          onInsertLayout={handleInsertLayout}
          onClose={() => {
            setInsertIndex(null)
            setShowBlockPicker(false)
          }}
        />
      )}
    </div>
  )
}

/**
 * The page opposite the one being edited.
 *
 * Read-only on purpose: the sortable context, the hotspot handlers and the
 * insert index are all bound to the current page, and making both halves live
 * would mean two of each. What the author needs first is simply to *see* what
 * faces what and where the gutter falls — one click makes this the live page.
 */
function FacingPage({
  page,
  index,
  bookId,
  theme,
  width,
  height,
  side,
}: {
  page: Page
  index: number
  bookId: string
  theme: Book['theme']
  width: number
  height: number
  side: 'left' | 'right'
}) {
  return (
    <button
      type="button"
      onClick={() => useEditorStore.getState().setCurrentPageIndex(index)}
      style={{ width, height }}
      title={`Edit page ${page.page_number}`}
      aria-label={`Page ${page.page_number} — click to edit it`}
      className={twMerge(
        'group relative shrink-0 overflow-hidden bg-white text-left ring-1 ring-black/40 transition',
        side === 'left'
          ? 'order-first rounded-l-[3px] shadow-[inset_-14px_0_20px_-16px_rgba(0,0,0,0.55)]'
          : 'rounded-r-[3px] shadow-[inset_14px_0_20px_-16px_rgba(0,0,0,0.55)]'
      )}
    >
      <div className="pointer-events-none absolute inset-0">
        <PageRenderer
          page={page}
          bookId={bookId}
          theme={theme}
          className="h-full w-full"
          pageSide={side}
        />
      </div>

      {/* Dimmed until hovered, so the eye stays on the page being edited while
          the composition of the whole spread is still readable. */}
      <span className="pointer-events-none absolute inset-0 bg-neutral-950/25 transition-colors group-hover:bg-neutral-950/5" />

      <span className="pointer-events-none absolute bottom-2 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900/90 px-2.5 py-1 text-[10px] font-semibold text-neutral-300 opacity-0 shadow transition-opacity group-hover:opacity-100">
        Page {page.page_number} — click to edit
      </span>
    </button>
  )
}
