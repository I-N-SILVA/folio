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

const BLOCK_TYPES: {
  type: Block['type']
  label: string
  icon: React.ReactNode
  defaults: Omit<Block, 'id' | 'type'>
}[] = [
  {
    type: 'text',
    label: 'Text',
    icon: <Type size={20} />,
    defaults: { variant: 'body', content: 'New text block', align: 'left' },
  },
  {
    type: 'image',
    label: 'Image',
    icon: <Image size={20} />,
    defaults: { src: 'https://placehold.co/800x450', alt: '', lightbox: false },
  },
  {
    type: 'video',
    label: 'Video',
    icon: <Video size={20} />,
    defaults: {
      src: 'https://www.w3schools.com/html/mov_bbb.mp4',
      poster: 'https://placehold.co/800x450',
    },
  },
  {
    type: 'audio',
    label: 'Audio',
    icon: <Music size={20} />,
    defaults: { src: 'https://www.w3schools.com/html/horse.ogg', title: 'Audio' },
  },
  {
    type: 'button',
    label: 'Button',
    icon: <MousePointerClick size={20} />,
    defaults: { label: 'Click me', href: 'https://example.com', variant: 'primary' },
  },
  {
    type: 'divider',
    label: 'Divider',
    icon: <Minus size={20} />,
    defaults: {},
  },
  {
    type: 'embed',
    label: 'Embed',
    icon: <Code2 size={20} />,
    defaults: { html: '<div>Paste embed HTML here</div>', height: 300 },
  },
  {
    type: 'data',
    label: 'Live data',
    icon: <RefreshCw size={20} />,
    defaults: { label: 'Live price', source: '/demo-live.json', path: 'product.price', prefix: '$', align: 'left' },
  },
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
        <span className="text-sm font-semibold text-neutral-200">Add Block</span>
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-neutral-400 hover:text-neutral-100"
        >
          <X size={16} />
        </button>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {BLOCK_TYPES.map(({ type, label, icon, defaults }) => (
          <button
            key={label}
            onClick={() => onPick(type, defaults)}
            className="flex flex-col items-center gap-1.5 rounded-lg bg-neutral-800 p-3 text-neutral-300 transition-colors hover:bg-neutral-700 hover:text-white"
          >
            {icon}
            <span className="text-xs">{label}</span>
          </button>
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
  } = useEditorStore()

  const [showBlockPicker, setShowBlockPicker] = useState(false)
  const [zoom, setZoom] = useState(1)
  const canvasRef = useRef<HTMLDivElement>(null)

  const currentPage = book?.pages?.[currentPageIndex]

  const zoomIndex = ZOOM_STEPS.indexOf(zoom)
  const prevStep = ZOOM_STEPS[Math.max(0, (zoomIndex === -1 ? 2 : zoomIndex) - 1)]
  const nextStep = ZOOM_STEPS[Math.min(ZOOM_STEPS.length - 1, (zoomIndex === -1 ? 2 : zoomIndex) + 1)]
  const pageWidth = Math.round(PAGE_DESIGN_WIDTH * zoom)

  const handleCanvasClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (!hotspotMode || !currentPage || !canvasRef.current) return
      const rect = canvasRef.current.getBoundingClientRect()
      const x = ((e.clientX - rect.left) / rect.width) * 100
      const y = ((e.clientY - rect.top) / rect.height) * 100
      addHotspot(currentPage.id, {
        id: crypto.randomUUID(),
        x: Math.round(x * 10) / 10,
        y: Math.round(y * 10) / 10,
        label: 'New Hotspot',
        icon: 'Info',
        action: 'modal',
        modal: { title: 'New Hotspot', body: '' }
      })

    },
    [hotspotMode, currentPage, addHotspot]
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
          {hotspotMode ? 'Placing hotspot' : 'Hotspot'}
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
            hotspotMode && 'cursor-crosshair'
          )}
          onClick={handleCanvasClick}
        >
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
