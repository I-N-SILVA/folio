'use client'

import { useRef, useState, useCallback } from 'react'
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
} from 'lucide-react'
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
import { PageRenderer } from '@/components/viewer/PageRenderer'
import { Modal } from '@/components/ui/Modal'
import type { Block } from '@/lib/book-schema'
import { PAGE_DESIGN_WIDTH, PAGE_RATIO, ZOOM_STEPS } from '@/lib/page-geometry'

// ─── Sortable Block Wrapper ───────────────────────────────────────────────────

function SortableBlock({
  id,
  label,
  isSelected,
  onClick,
  children,
}: {
  id: string
  /** Block type, surfaced on the selection so it's clear what's being edited. */
  label: string
  isSelected: boolean
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
      onClick={onClick}
      className={twMerge(
        'relative group/block transition-all outline-none rounded-lg',
        isSelected ? 'ring-2 ring-inset ring-[var(--accent-vivid)]' : 'hover:ring-1 hover:ring-inset hover:ring-neutral-400',
        isDragging && 'opacity-50 z-50 ring-2 ring-[var(--accent-vivid)] shadow-xl',
        !isSelected && 'cursor-pointer'
      )}
    >
      {/* Drag handle — inside the block bounds so it survives the page
          frame's overflow-hidden even near the left edge; visible on hover
          so reordering is discoverable before a block is selected. */}
      <div
        {...listeners}
        {...attributes}
        tabIndex={0}
        aria-label="Drag to reorder block"
        className={twMerge(
          'absolute left-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-[var(--accent-vivid)] text-white shadow-lg transition-all cursor-grab active:cursor-grabbing hover:bg-[var(--accent-vivid-hover)] hover:scale-110 z-50',
          isSelected
            ? 'opacity-100'
            : 'opacity-0 group-hover/block:opacity-100 focus-visible:opacity-100'
        )}
      >
        <GripVertical size={14} />
      </div>

      {/* Names what's selected. The ring alone doesn't say whether you're about
          to restyle a heading or a button. */}
      {isSelected && (
        <span className="pointer-events-none absolute -top-2 right-2 z-50 rounded-full bg-[var(--accent-vivid)] px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider text-white shadow-lg">
          {label}
        </span>
      )}

      <div className={twMerge(isSelected ? 'pointer-events-auto' : 'pointer-events-none')}>
        {children}
      </div>
    </div>
  )
}

// ─── Block Picker Modal ───────────────────────────────────────────────────────

interface BlockChoice {
  type: Block['type']
  label: string
  /** What it's for, so the picker doesn't rely on an icon carrying the meaning. */
  hint: string
  icon: React.ReactNode
  defaults: Omit<Block, 'id' | 'type'>
}

const BLOCK_TYPES: BlockChoice[] = [
  {
    type: 'text',
    label: 'Text',
    hint: 'Headings, body, quotes',
    icon: <Type size={18} />,
    defaults: { variant: 'body', content: 'New text block', align: 'left' },
  },
  {
    type: 'image',
    label: 'Image',
    hint: 'Photo or illustration',
    icon: <Image size={18} />,
    defaults: { src: 'https://placehold.co/800x450', alt: '', lightbox: false },
  },
  {
    type: 'video',
    label: 'Video',
    hint: 'Inline player with poster',
    icon: <Video size={18} />,
    defaults: {
      src: 'https://www.w3schools.com/html/mov_bbb.mp4',
      poster: 'https://placehold.co/800x450',
    },
  },
  {
    type: 'audio',
    label: 'Audio',
    hint: 'Narration or a track',
    icon: <Music size={18} />,
    defaults: { src: 'https://www.w3schools.com/html/horse.ogg', title: 'Audio' },
  },
  {
    type: 'button',
    label: 'Button',
    hint: 'A measured call to action',
    icon: <MousePointerClick size={18} />,
    defaults: { label: 'Click me', href: 'https://example.com', variant: 'primary' },
  },
  {
    type: 'divider',
    label: 'Divider',
    hint: 'A rule between sections',
    icon: <Minus size={18} />,
    defaults: {},
  },
  {
    type: 'embed',
    label: 'Embed',
    hint: 'Paste third-party HTML',
    icon: <Code2 size={18} />,
    defaults: { html: '<div>Paste embed HTML here</div>', height: 300 },
  },
  {
    type: 'data',
    label: 'Live data',
    hint: 'A field that refreshes after publish',
    icon: <RefreshCw size={18} />,
    defaults: { label: 'Live price', source: '/demo-live.json', path: 'product.price', prefix: '$', align: 'left' },
  },
]

/** Three intents rather than eight equivalent tiles. */
const BLOCK_GROUPS: { title: string; types: Block['type'][] }[] = [
  { title: 'Text', types: ['text', 'divider'] },
  { title: 'Media', types: ['image', 'video', 'audio'] },
  { title: 'Interactive', types: ['button', 'data', 'embed'] },
]

interface BlockPickerModalProps {
  onPick: (type: Block['type'], defaults: Omit<Block, 'id' | 'type'>) => void
  onClose: () => void
}

function BlockPickerModal({ onPick, onClose }: BlockPickerModalProps) {
  return (
    <Modal
      onClose={onClose}
      title="Add block"
      hideCloseButton
      className="w-80 max-w-[calc(100vw-2rem)] border border-neutral-700 bg-neutral-900 p-4"
    >
      <div className="mb-4 flex items-center justify-between">
        <span className="text-sm font-semibold text-neutral-100">Add a block</span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-neutral-400 transition-colors hover:text-neutral-100"
        >
          <X size={16} />
        </button>
      </div>

      {/* Grouped, with a line on what each one is for. Eight identical tiles
          made the reader work out the difference between Embed and Live data
          from a pair of icons. */}
      <div className="space-y-4">
        {BLOCK_GROUPS.map((group) => (
          <section key={group.title}>
            <h3 className="mb-1.5 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
              {group.title}
            </h3>
            <div className="space-y-1">
              {group.types.map((type) => {
                const choice = BLOCK_TYPES.find((b) => b.type === type)
                if (!choice) return null
                return (
                  <button
                    key={choice.label}
                    onClick={() => onPick(choice.type, choice.defaults)}
                    className="flex w-full items-center gap-3 rounded-lg border border-transparent px-2 py-2 text-left transition-colors hover:border-neutral-700 hover:bg-neutral-800"
                  >
                    <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-neutral-800 text-neutral-300">
                      {choice.icon}
                    </span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-neutral-100">
                        {choice.label}
                      </span>
                      <span className="block truncate text-[11px] text-neutral-500">
                        {choice.hint}
                      </span>
                    </span>
                  </button>
                )
              })}
            </div>
          </section>
        ))}
      </div>
    </Modal>
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
    addBlock,
    addHotspot,
    updateHotspot,
  } = useEditorStore()

  const [showBlockPicker, setShowBlockPicker] = useState(false)
  const [zoom, setZoom] = useState(1)
  const canvasRef = useRef<HTMLDivElement>(null)

  const currentPage = book?.pages?.[currentPageIndex]

  const zoomIndex = ZOOM_STEPS.indexOf(zoom)
  const prevStep = ZOOM_STEPS[Math.max(0, (zoomIndex === -1 ? 2 : zoomIndex) - 1)]
  const nextStep = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, (zoomIndex === -1 ? 2 : zoomIndex) + 1)]
  const pageWidth = Math.round(PAGE_DESIGN_WIDTH * zoom)

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
      addHotspot(currentPage.id, {
        id: crypto.randomUUID(),
        x: Math.min(100, Math.max(0, Math.round(x * 10) / 10)),
        y: Math.min(100, Math.max(0, Math.round(y * 10) / 10)),
        label: 'New hotspot',
        icon: 'Info',
        action: 'modal',
        modal: { title: 'New hotspot', body: '' },
      })
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

      if (!delta || !selectedHotspotId) return
      const hotspot = currentPage.hotspots?.find((h) => h.id === selectedHotspotId)
      if (!hotspot) return

      e.preventDefault()
      updateHotspot(currentPage.id, selectedHotspotId, {
        x: Math.min(100, Math.max(0, Math.round((hotspot.x + delta.x) * 10) / 10)),
        y: Math.min(100, Math.max(0, Math.round((hotspot.y + delta.y) * 10) / 10)),
      })
    },
    [hotspotMode, currentPage, selectedHotspotId, placeHotspot, updateHotspot]
  )

  const handleBlockPick = useCallback(
    (type: Block['type'], defaults: Omit<Block, 'id' | 'type'>) => {
      if (!currentPage) return
      const newBlock = { type, id: crypto.randomUUID(), ...defaults } as Block
      addBlock(currentPage.id, newBlock)
      setShowBlockPicker(false)
    },
    [currentPage, addBlock]
  )

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
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

        {/* Zoom */}
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

        <span className="h-5 w-px bg-neutral-800" aria-hidden="true" />

        <button
          onClick={() => setHotspotMode(!hotspotMode)}
          aria-pressed={hotspotMode}
          className={twMerge(
            'flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors',
            hotspotMode
              ? 'bg-amber-400 text-amber-950 shadow-[0_0_0_1px_rgba(251,191,36,0.4),0_4px_12px_rgba(251,191,36,0.25)]'
              : 'border border-neutral-800 bg-neutral-950/60 text-neutral-400 hover:text-neutral-100'
          )}
        >
          <Crosshair size={13} />
          {hotspotMode ? 'Click the page to place' : 'Add hotspot'}
        </button>
      </div>

      {/* Canvas area */}
      <div className="flex-1 overflow-auto bg-[radial-gradient(#232323_1px,transparent_1px)] p-8 [background-size:22px_22px]">
        <div
          ref={canvasRef}
          style={{ width: pageWidth, height: Math.round(pageWidth * PAGE_RATIO) }}
          className={twMerge(
            // Layered elevation reads as a physical sheet lifted off the
            // surface, rather than a div with a drop shadow.
            'relative mx-auto overflow-hidden rounded-[3px] bg-white',
            'shadow-[0_1px_2px_rgba(0,0,0,0.35),0_12px_28px_-8px_rgba(0,0,0,0.55),0_40px_80px_-32px_rgba(0,0,0,0.7)]',
            'ring-1 ring-black/40',
            hotspotMode && 'cursor-crosshair',
            hotspotMode && 'ring-2 ring-amber-400/70 focus:outline-none focus-visible:ring-4'
          )}
          onClick={handleCanvasClick}
          onKeyDown={handleCanvasKeyDown}
          // Focusable only while placing, so tabbing through a normal editing
          // session doesn't stop on the page itself. With it armed, the page is
          // the control: Enter drops a hotspot, arrows move the selected one.
          tabIndex={hotspotMode || selectedHotspotId ? 0 : -1}
          role={hotspotMode ? 'application' : undefined}
          aria-label={
            hotspotMode
              ? 'Page canvas. Press Enter to place a hotspot in the centre, then use the arrow keys to move it.'
              : undefined
          }
        >
          {/* Placing a hotspot required knowing that the toolbar toggle armed a
              mode, and that the mode wanted a click on the page. Neither was
              stated anywhere, for the feature the product leads with. */}
          {hotspotMode && (
            <div className="pointer-events-none absolute inset-x-0 top-4 z-30 flex justify-center">
              <p className="rounded-full bg-amber-400 px-3 py-1.5 text-[11px] font-semibold text-amber-950 shadow-lg">
                Click anywhere on the page to pin a hotspot — or press Enter
              </p>
            </div>
          )}

          {/* A blank page offered no hint about what to do next — the only
              affordance was a button in the footer, below the fold of the
              page itself. */}
          {currentPage.blocks.length === 0 && !hotspotMode && (
            <button
              onClick={() => setShowBlockPicker(true)}
              className="absolute inset-4 z-20 flex flex-col items-center justify-center gap-3 rounded-sm border border-dashed border-neutral-300 text-neutral-400 transition-colors hover:border-[var(--accent-vivid)]/60 hover:text-[var(--accent-vivid)]"
            >
              <span className="grid h-11 w-11 place-items-center rounded-full border border-current">
                <Plus size={20} />
              </span>
              <span className="text-sm font-medium">Add your first block</span>
              <span className="max-w-[220px] text-center text-xs text-neutral-400">
                Text, images, video, buttons, or a live data field.
              </span>
            </button>
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
                  renderBlockWrapper={(block, children) => (
                    <SortableBlock
                      key={block.id}
                      id={block.id}
                      label={block.type === 'text' ? (block.variant ?? 'text') : block.type}
                      isSelected={selectedBlockId === block.id}
                      onClick={(e) => {
                        e.stopPropagation()
                        selectBlock(block.id)
                      }}
                    >
                      {children}
                    </SortableBlock>
                  )}
                />
              </SortableContext>
            </DndContext>
          </div>

          {/* Hotspot markers */}
          {!hotspotMode &&
            currentPage.hotspots.map((hotspot) => (
              <div
                key={hotspot.id}
                className="absolute group z-30"
                style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
              >
                <button
                  onClick={(e) => {
                    e.stopPropagation()
                    useEditorStore.getState().selectHotspot(hotspot.id)
                  }}
                  className={twMerge(
                    "w-5 h-5 rounded-full border-2 border-white shadow-md cursor-pointer -translate-x-1/2 -translate-y-1/2 hover:scale-110 transition-transform",
                    selectedHotspotId === hotspot.id ? "bg-[var(--accent-vivid)] ring-2 ring-white" : "bg-amber-400"
                  )}
                  title={hotspot.label}
                />
                
                {/* Hover Peek */}
                <div className="absolute left-1/2 bottom-full mb-3 -translate-x-1/2 w-48 p-3 bg-neutral-900 text-white rounded-lg shadow-xl opacity-0 scale-95 pointer-events-none group-hover:opacity-100 group-hover:scale-100 transition-all origin-bottom">
                  <div className="text-xs font-bold mb-1 truncate">{hotspot.modal.title || 'Untitled Hotspot'}</div>
                  <div className="text-[10px] text-neutral-400 line-clamp-2">{hotspot.modal.body || 'No description provided.'}</div>
                  {/* Triangle pointer */}
                  <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 border-4 border-transparent border-t-neutral-900" />
                </div>
              </div>
            ))}

          {hotspotMode &&
            currentPage.hotspots.map((hotspot) => (
              <div
                key={hotspot.id}
                className="absolute w-4 h-4 rounded-full bg-amber-400 border-2 border-white shadow pointer-events-none -translate-x-1/2 -translate-y-1/2"
                style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
              />
            ))}
        </div>
      </div>

      {/* Add Block button */}
      <div className="px-4 py-3 border-t border-neutral-800 shrink-0 flex justify-center">
        <button
          onClick={() => setShowBlockPicker(true)}
          className="flex items-center gap-1.5 rounded-full bg-[var(--accent-vivid)] px-5 py-2 text-xs font-semibold text-white shadow-[0_8px_24px_rgba(124,92,255,0.35)] transition-colors hover:bg-[var(--accent-vivid-hover)]"
        >
          <Plus size={14} />
          Add Block
        </button>
      </div>

      {showBlockPicker && (
        <BlockPickerModal
          onPick={handleBlockPick}
          onClose={() => setShowBlockPicker(false)}
        />
      )}
    </div>
  )
}
