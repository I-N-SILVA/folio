'use client'

import { twMerge } from 'tailwind-merge'
import { Plus, Trash2, GripVertical } from 'lucide-react'
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
import type { Page } from '@/lib/book-schema'

const PAGE_TYPE_COLORS: Record<Page['type'], string> = {
  cover: 'bg-violet-700 text-violet-100',
  content: 'bg-neutral-700 text-neutral-200',
  back: 'bg-amber-700 text-amber-100',
}

interface SortablePageItemProps {
  page: Page
  index: number
  isSelected: boolean
  isOnly: boolean
  onSelect: () => void
  onDelete: () => void
}

function SortablePageItem({
  page,
  index,
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

      {/* Page thumbnail placeholder */}
      <div className="w-10 h-14 rounded bg-neutral-700 border border-neutral-600 flex items-center justify-center text-xs text-neutral-400 shrink-0">
        {page.page_number}
      </div>

      {/* Info */}
      <div className="flex-1 min-w-0">
        <div className="text-xs text-neutral-300 truncate font-medium">
          Page {page.page_number}
        </div>
        <div className="flex items-center gap-1 mt-0.5">
          <span
            className={twMerge(
              'text-[10px] px-1 rounded font-medium',
              PAGE_TYPE_COLORS[page.type]
            )}
          >
            {page.type}
          </span>
          <span className="text-[10px] text-neutral-500">{page.layout}</span>
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
  const { book, currentPageIndex, setCurrentPageIndex, addPage, removePage, reorderPages } =
    useEditorStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  if (!book?.pages) return null

  const pages = book.pages

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
    <div className="flex flex-col h-full overflow-hidden">
      <div className="px-3 py-2 border-b border-neutral-800 shrink-0">
        <span className="text-xs font-semibold text-neutral-400 uppercase tracking-wider">
          Pages
        </span>
      </div>

      <div className="flex-1 overflow-y-auto p-2 space-y-1">
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
                isSelected={currentPageIndex === index}
                isOnly={pages.length === 1}
                onSelect={() => setCurrentPageIndex(index)}
                onDelete={() => removePage(page.id)}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>

      <div className="p-2 border-t border-neutral-800 shrink-0">
        <button
          onClick={addPage}
          className="w-full flex items-center justify-center gap-1.5 py-1.5 rounded border border-dashed border-neutral-700 text-neutral-400 hover:text-neutral-200 hover:border-neutral-500 text-xs transition-colors"
        >
          <Plus size={14} />
          Add Page
        </button>
      </div>
    </div>
  )
}
