'use client'

import { useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { Plus, Trash2, GripVertical, Layers, Box, Layout as LayoutIcon, Wand2 } from 'lucide-react'
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEditorStore } from '@/lib/editor-store'
import { PageRenderer } from '@/components/viewer/PageRenderer'
import { PAGE_TEMPLATES } from '@/lib/templates'
import type { Page, Block } from '@/lib/book-schema'

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
    defaults: { label: 'Explore More', href: 'https://riffle.app', variant: 'primary' },
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

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={twMerge(
        'group relative flex items-center gap-2 px-2 py-2 rounded cursor-pointer border transition-colors select-none',
        isSelected
          ? 'bg-neutral-700 border-neutral-500'
          : 'border-transparent hover:bg-neutral-800',
        isDragging && 'opacity-50 z-50'
      )}
      onClick={onSelect}
    >
      {/* Drag handle */}
      <button
        {...listeners}
        {...attributes}
        onClick={(e) => e.stopPropagation()}
        className="text-neutral-600 hover:text-neutral-400 cursor-grab active:cursor-grabbing shrink-0"
        aria-label="Drag to reorder"
      >
        <GripVertical size={14} />
      </button>

      {/* Page thumbnail preview */}
      <div className="w-10 h-14 rounded bg-neutral-700 border border-neutral-600 shrink-0 overflow-hidden relative">
        <div className="absolute inset-0 origin-top-left" style={{ width: 280, height: 396, transform: 'scale(0.0357)', transformOrigin: 'top left' }}>
          <PageRenderer page={page} bookId={bookId} className="w-full h-full" />
        </div>
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-[11px] text-neutral-300 truncate font-medium">
          Page {page.page_number}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span
            className={twMerge(
              'text-[9px] px-1 rounded font-bold uppercase',
              PAGE_TYPE_COLORS[page.type]
            )}
          >
            {page.type}
          </span>
        </div>
      </div>

      {/* Delete button */}
      <button
        onClick={(e) => {
          e.stopPropagation()
          onDelete()
        }}
        disabled={isOnly}
        className={twMerge(
          'shrink-0 p-1 rounded transition-colors',
          isOnly
            ? 'text-neutral-700 cursor-not-allowed'
            : 'text-neutral-600 hover:text-red-400 opacity-0 group-hover:opacity-100'
        )}
        aria-label="Delete page"
      >
        <Trash2 size={13} />
      </button>
    </div>
  )
}

export function PageListSidebar() {
  const { book, currentPageIndex, setCurrentPageIndex, addPage, removePage, reorderPages, addBlock, setPageBlocks, updatePage, selectBlock, selectHotspot, selectedBlockId, selectedHotspotId } =
    useEditorStore()
  const [activeTab, setActiveTab] = useState<'pages' | 'layers' | 'library' | 'templates'>('pages')

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
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
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all',
            activeTab === 'pages' ? 'bg-[#0066ff]/15 text-white ring-1 ring-inset ring-[#0066ff]/30' : 'text-neutral-500 hover:text-neutral-300'
          )}
        >
          <Layers size={13} />
          Pages
        </button>
        <button
          onClick={() => setActiveTab('layers')}
          className={twMerge(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all',
            activeTab === 'layers' ? 'bg-[#0066ff]/15 text-white ring-1 ring-inset ring-[#0066ff]/30' : 'text-neutral-500 hover:text-neutral-300'
          )}
        >
          <GripVertical size={13} />
          Layers
        </button>
        <button
          onClick={() => setActiveTab('library')}
          className={twMerge(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all',
            activeTab === 'library' ? 'bg-[#0066ff]/15 text-white ring-1 ring-inset ring-[#0066ff]/30' : 'text-neutral-500 hover:text-neutral-300'
          )}
        >
          <Box size={13} />
          Blocks
        </button>
        <button
          onClick={() => setActiveTab('templates')}
          className={twMerge(
            'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-md text-[10px] font-bold uppercase tracking-tight transition-all',
            activeTab === 'templates' ? 'bg-[#0066ff]/15 text-white ring-1 ring-inset ring-[#0066ff]/30' : 'text-neutral-500 hover:text-neutral-300'
          )}
        >
          <LayoutIcon size={13} />
          Layouts
        </button>
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'pages' && (
          <div className="p-2 space-y-1">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={pages.map((p) => p.id)}
                strategy={verticalListSortingStrategy}
              >
                {pages.map((page, index) => (
                  <SortablePageItem
                    key={page.id}
                    page={page}
                    index={index}
                    bookId={book.id}
                    isSelected={currentPageIndex === index}
                    isOnly={pages.length === 1}
                    onSelect={() => setCurrentPageIndex(index)}
                    onDelete={() => removePage(page.id)}
                  />
                ))}
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
                    selectedBlockId === b.id ? "bg-blue-500/20 text-blue-400" : "hover:bg-neutral-800 text-neutral-300"
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
                    selectedHotspotId === h.id ? "bg-blue-500/20 text-blue-400" : "hover:bg-neutral-800 text-neutral-300"
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
                    const newBlocks = tpl.blocks.map(b => ({ ...b, id: crypto.randomUUID() })) as Block[]
                    setPageBlocks(currentPage.id, newBlocks)
                    updatePage(currentPage.id, { layout: tpl.layout })
                  }}
                  className="flex flex-col p-4 rounded-xl bg-neutral-800/50 border border-neutral-700 hover:border-blue-500/50 hover:bg-neutral-800 text-left transition-all group"
                >
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-xs font-bold text-neutral-200">{tpl.label}</div>
                    <Wand2 size={12} className="text-neutral-600 group-hover:text-blue-400 transition-colors" />
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
