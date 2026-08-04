'use client'

import { useEffect, useRef, useState } from 'react'
import { toast } from 'sonner'
import { twMerge } from 'tailwind-merge'
import { Plus, Trash2, GripVertical, Layers, Box, Layout as LayoutIcon, Wand2 } from 'lucide-react'
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
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEditorStore } from '@/lib/editor-store'
import { PageRenderer } from '@/components/viewer/PageRenderer'
import { PAGE_TEMPLATES } from '@/lib/templates'
import type { Page, Block } from '@/lib/book-schema'
import { PAGE_ASPECT, PAGE_DESIGN_HEIGHT, PAGE_DESIGN_WIDTH, pageScale } from '@/lib/page-geometry'

const BLOCK_LIBRARY: {
  type: Block['type']
  label: string
  icon: React.ReactNode
  defaults: Omit<Block, 'id' | 'type'>
}[] = [
  {
    type: 'text',
    label: 'Body Text',
    icon: <Box size={16} />,
    defaults: { variant: 'body', content: 'New body text section...', align: 'left' },
  },
  {
    type: 'text',
    label: 'Heading',
    icon: <Box size={16} />,
    defaults: { variant: 'title', content: 'Section Title', align: 'left' },
  },
  {
    type: 'image',
    label: 'Image',
    icon: <Box size={16} />,
    defaults: { src: 'https://placehold.co/800x450', alt: '', lightbox: true },
  },
  {
    type: 'video',
    label: 'Video',
    icon: <Box size={16} />,
    defaults: { src: 'https://www.w3schools.com/html/mov_bbb.mp4', poster: 'https://placehold.co/800x450' },
  },
  {
    type: 'button',
    label: 'Button',
    icon: <Box size={16} />,
    defaults: { label: 'Explore More', href: 'https://qlico.app', variant: 'primary' },
  },
  {
    type: 'divider',
    label: 'Divider',
    icon: <Box size={16} />,
    defaults: {},
  },
]

const PAGE_TYPE_COLORS: Record<Page['type'], string> = {
  cover: 'bg-violet-700 text-violet-100',
  content: 'bg-neutral-700 text-neutral-200',
  back: 'bg-amber-700 text-amber-100',
}

interface SortablePageItemProps {
  page: Page
  index: number
  bookId: string
  isSelected: boolean
  isOnly: boolean
  onSelect: () => void
  onDelete: () => void
}

function SortablePageItem({
  page,
  index,
  bookId,
  isSelected,
  isOnly,
  onSelect,
  onDelete,
}: SortablePageItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: page.id })

  // Each frame measures itself. Observing a parent and reading a child's width
  // only gets one callback — the grid never resizes again — and that callback
  // lands before the children have been laid out, so the scale stayed at 0 and
  // every thumbnail rendered its page at zero size.
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)

  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const obs = new ResizeObserver(([entry]) => {
      setScale(pageScale(entry.contentRect.width))
    })
    obs.observe(frame)
    return () => obs.disconnect()
  }, [])

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={twMerge('group relative select-none', isDragging && 'z-50 opacity-50')}
    >
      {/* A 44px-wide page can only ever be a smudge — an A4 body line lands
          near a single pixel. Two columns of ~100px is the smallest size at
          which a page reads as its own layout, which is the whole point of a
          page navigator. */}
      {/* A div, not a button: pages contain button and audio blocks, and
          interactive content inside a <button> is invalid HTML that React
          reports as a hydration error. The click target is the overlay below,
          a sibling of the rendered page rather than its ancestor. */}
      <div
        ref={frameRef}
        className={twMerge(
          'relative w-full overflow-hidden rounded-[3px] bg-white transition-all duration-200',
          // A thin outline plus real elevation, rather than a chunky offset
          // ring: the pages sit close together and a heavy selected state
          // dominated the whole rail.
          isSelected
            ? 'ring-2 ring-[var(--accent-vivid)] shadow-[0_0_0_1px_rgba(124,92,255,0.35),0_8px_20px_-6px_rgba(124,92,255,0.45)]'
            : 'ring-1 ring-black/50 shadow-[0_1px_2px_rgba(0,0,0,0.4),0_6px_14px_-8px_rgba(0,0,0,0.6)] group-hover:-translate-y-0.5 group-hover:ring-neutral-500'
        )}
        style={{ aspectRatio: PAGE_ASPECT }}
      >
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 origin-top-left"
          style={{
            width: PAGE_DESIGN_WIDTH,
            height: PAGE_DESIGN_HEIGHT,
            transform: `scale(${scale})`,
            opacity: scale > 0 ? 1 : 0,
          }}
        >
          <PageRenderer page={page} bookId={bookId} className="w-full h-full" />
        </div>

        <button
          type="button"
          aria-current={isSelected ? 'true' : undefined}
          onClick={onSelect}
          className="absolute inset-0 z-10 cursor-pointer"
        >
          <span className="sr-only">{`Go to page ${page.page_number}`}</span>
        </button>
      </div>

      {/* Number and type sit under the page rather than beside it, so the
          thumbnail gets the full column width. */}
      <div className="mt-2 flex items-center gap-1.5 px-0.5">
        <span
          className={twMerge(
            'min-w-[16px] text-center text-[11px] font-semibold tabular-nums transition-colors',
            isSelected ? 'text-[var(--accent-vivid)]' : 'text-neutral-400'
          )}
        >
          {page.page_number}
        </span>
        {/* Only the non-default page types earn a badge — labelling every
            middle page "CONTENT" is noise that competes with the previews. */}
        {page.type !== 'content' && (
          <span
            className={twMerge(
              'rounded px-1 text-[9px] font-bold uppercase leading-4',
              PAGE_TYPE_COLORS[page.type]
            )}
          >
            {page.type}
          </span>
        )}
        <span className="flex-1" />
        <button
          {...listeners}
          {...attributes}
          onClick={(e) => e.stopPropagation()}
          className="cursor-grab text-neutral-600 opacity-0 transition-opacity hover:text-neutral-300 group-hover:opacity-100 active:cursor-grabbing"
          aria-label={`Drag page ${page.page_number} to reorder`}
        >
          <GripVertical size={13} />
        </button>
        <button
          onClick={(e) => {
            e.stopPropagation()
            onDelete()
          }}
          disabled={isOnly}
          className={twMerge(
            'rounded transition-colors',
            isOnly
              ? 'cursor-not-allowed text-neutral-700'
              : 'text-neutral-600 opacity-0 hover:text-red-400 group-hover:opacity-100'
          )}
          aria-label={`Delete page ${page.page_number}`}
        >
          <Trash2 size={13} />
        </button>
      </div>
    </div>
  )
}

interface PageListSidebarProps {
  /** Lets the mobile sheet dismiss itself once a page is chosen. */
  onPageSelected?: () => void
}

export function PageListSidebar({ onPageSelected }: PageListSidebarProps = {}) {
  const { book, currentPageIndex, setCurrentPageIndex, addPage, removePage, reorderPages, addBlock, setPageBlocks, updatePage, selectBlock, selectHotspot, selectedBlockId, selectedHotspotId } =
    useEditorStore()
  const [activeTab, setActiveTab] = useState<'pages' | 'layers' | 'library' | 'templates'>('pages')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
  )

  if (!book?.pages) return null

  const pages = book.pages
  const currentPage = pages[currentPageIndex]

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = pages.findIndex((p) => p.id === active.id)
    const toIndex = pages.findIndex((p) => p.id === over.id)
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderPages(fromIndex, toIndex)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-hidden bg-neutral-900 border-r border-neutral-800">
      {/* Tab Switcher */}
      <div className="flex p-1 gap-1 bg-neutral-950 border-b border-neutral-800 shrink-0">
        <button
          onClick={() => setActiveTab('pages')}
          className={twMerge(
            'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all',
            activeTab === 'pages' ? 'bg-[var(--accent-vivid)]/15 text-white ring-1 ring-inset ring-[var(--accent-vivid)]/30' : 'text-neutral-500 hover:text-neutral-300'
          )}
        >
          <Layers size={13} />
          Pages
        </button>
        <button
          onClick={() => setActiveTab('layers')}
          className={twMerge(
            'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all',
            activeTab === 'layers' ? 'bg-[var(--accent-vivid)]/15 text-white ring-1 ring-inset ring-[var(--accent-vivid)]/30' : 'text-neutral-500 hover:text-neutral-300'
          )}
        >
          <GripVertical size={13} />
          Layers
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={twMerge(
            'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all',
            activeTab === 'library' ? 'bg-[var(--accent-vivid)]/15 text-white ring-1 ring-inset ring-[var(--accent-vivid)]/30' : 'text-neutral-500 hover:text-neutral-300'
          )}
        >
          <Box size={13} />
          Blocks
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={twMerge(
            'flex-1 min-w-0 flex flex-col items-center justify-center gap-1 py-2 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all',
            activeTab === 'templates' ? 'bg-[var(--accent-vivid)]/15 text-white ring-1 ring-inset ring-[var(--accent-vivid)]/30' : 'text-neutral-500 hover:text-neutral-300'
          )}
        >
          <LayoutIcon size={13} />
          Layouts
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'pages' && (
          <div className="p-3">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              {/* rectSortingStrategy, not vertical: the pages are a grid now,
                  so reordering has to consider both axes. */}
              <SortableContext items={pages.map((p) => p.id)} strategy={rectSortingStrategy}>
                <div className="grid grid-cols-2 gap-x-3 gap-y-4 sm:grid-cols-3 lg:grid-cols-2">
                  {pages.map((page, index) => (
                    <SortablePageItem
                      key={page.id}
                      page={page}
                      index={index}
                      bookId={book.id}
                      isSelected={currentPageIndex === index}
                      isOnly={pages.length === 1}
                      onSelect={() => {
                        setCurrentPageIndex(index)
                        onPageSelected?.()
                      }}
                      onDelete={() => removePage(page.id)}
                    />
                  ))}
                </div>
              </SortableContext>
            </DndContext>
          </div>
        )}

        {activeTab === 'layers' && currentPage && (
          <div className="p-4 space-y-4">
            <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Page {currentPage.page_number} Layers</div>
            
            <div className="space-y-1">
              <div className="text-[10px] font-bold text-neutral-600 uppercase mb-2">Blocks</div>
              {currentPage.blocks.length === 0 && <div className="text-xs text-neutral-500 italic px-2">No blocks on this page.</div>}
              {currentPage.blocks.map((b) => (
                <button
                  key={b.id}
                  onClick={() => selectBlock(b.id)}
                  className={twMerge(
                    "flex items-center gap-2 w-full p-2 text-left text-xs rounded transition-colors",
                    selectedBlockId === b.id ? "bg-[var(--accent-vivid)]/20 text-[var(--accent-vivid)]" : "hover:bg-neutral-800 text-neutral-300"
                  )}
                >
                  <Box size={14} className="opacity-50" />
                  <span className="capitalize">{b.type} block</span>
                  {b.type === 'text' && <span className="text-[10px] text-neutral-500 truncate max-w-[100px] ml-auto">{(b as any).content}</span>}
                  {b.type === 'data' && <span className="text-[10px] text-neutral-500 truncate max-w-[100px] ml-auto">{(b as any).label}</span>}
                </button>
              ))}

              <div className="text-[10px] font-bold text-neutral-600 uppercase mt-4 mb-2">Hotspots</div>
              {currentPage.hotspots.length === 0 && <div className="text-xs text-neutral-500 italic px-2">No hotspots on this page.</div>}
              {currentPage.hotspots.map((h) => (
                <button
                  key={h.id}
                  onClick={() => selectHotspot(h.id)}
                  className={twMerge(
                    "flex items-center gap-2 w-full p-2 text-left text-xs rounded transition-colors",
                    selectedHotspotId === h.id ? "bg-[var(--accent-vivid)]/20 text-[var(--accent-vivid)]" : "hover:bg-neutral-800 text-neutral-300"
                  )}
                >
                  <Wand2 size={14} className="opacity-50" />
                  <span className="truncate">{h.label || 'Unnamed Hotspot'}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'library' && (
          <div className="p-4 space-y-4">
            <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Content Library</div>
            <div className="grid grid-cols-1 gap-2">
              {BLOCK_LIBRARY.map((item) => (
                <button
                  key={item.label}
                  onClick={() => {
                    if (currentPage) {
                      addBlock(currentPage.id, {
                        id: crypto.randomUUID(),
                        type: item.type,
                        ...item.defaults,
                      } as Block)
                    }
                  }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-neutral-800/50 border border-neutral-700 hover:border-neutral-500 hover:bg-neutral-800 text-neutral-300 hover:text-white transition-all text-left group"
                >
                  <div className="w-8 h-8 rounded-lg bg-neutral-900 flex items-center justify-center group-hover:scale-110 transition-transform">
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <div className="text-xs font-bold">{item.label}</div>
                    <div className="text-[10px] text-neutral-500 mt-0.5 capitalize">{item.type}</div>
                  </div>
                  <Plus size={14} className="text-neutral-600 group-hover:text-neutral-300" />
                </button>
              ))}
            </div>
          </div>
        )}

        {activeTab === 'templates' && (
          <div className="p-4 space-y-4">
            <div className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-2">Page Templates</div>
            <div className="grid grid-cols-1 gap-3">
              {PAGE_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => {
                    if (!currentPage) return
                    const hadContent = currentPage.blocks.length > 0
                    const newBlocks = tpl.blocks.map(b => ({ ...b, id: crypto.randomUUID() })) as Block[]
                    setPageBlocks(currentPage.id, newBlocks)
                    updatePage(currentPage.id, { layout: tpl.layout })
                    if (hadContent) toast('Page content replaced — ⌘Z to undo')
                  }}
                  className="flex flex-col p-4 rounded-xl bg-neutral-800/50 border border-neutral-700 hover:border-[var(--accent-vivid)]/50 hover:bg-neutral-800 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-neutral-200">{tpl.label}</div>
                    <Wand2 size={12} className="text-neutral-600 group-hover:text-[var(--accent-vivid)] transition-colors" />
                  </div>
                  <div className="text-[10px] text-neutral-500 leading-relaxed line-clamp-2 mb-3">
                    {tpl.description}
                  </div>
                  <div className="flex gap-1 mt-auto">
                    {tpl.blocks.slice(0, 4).map((b, i) => (
                      <div key={i} className="w-4 h-1 rounded-full bg-neutral-700 group-hover:bg-neutral-600" />
                    ))}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {activeTab === 'pages' && (
        <div className="p-3 border-t border-neutral-800 shrink-0">
          <button
            onClick={addPage}
            className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-neutral-800 hover:bg-neutral-700 text-neutral-300 hover:text-white text-xs font-bold transition-all border border-neutral-700"
          >
            <Plus size={14} />
            Append New Page
          </button>
        </div>
      )}
    </div>
  )
}
