'use client'

import { createPortal } from 'react-dom'
import { twMerge } from 'tailwind-merge'
import { X, GripVertical, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
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
  rectSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { useEditorStore } from '@/lib/editor-store'
import { PageRenderer } from '@/components/viewer/PageRenderer'
import type { Page } from '@/lib/book-schema'

interface PageManagerModalProps {
  onClose: () => void
}

function SortableGridPage({ page, bookId, index, isSelected, onSelect }: { page: Page; bookId: string; index: number; isSelected: boolean; onSelect: () => void }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({ id: page.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <div
      ref={setNodeRef}
      style={style}
      onClick={onSelect}
      className={twMerge(
        'group relative flex flex-col items-center gap-2 p-2 rounded-xl cursor-pointer border-2 transition-all bg-neutral-900',
        isSelected ? 'border-[var(--accent-vivid)]' : 'border-transparent hover:border-neutral-700',
        isDragging && 'opacity-50 z-50 shadow-2xl scale-105'
      )}
    >
      {/* Thumbnail */}
      <div className="w-full aspect-[1/1.41] rounded bg-white shadow-sm overflow-hidden relative">
        <div className="absolute inset-0 origin-top-left" style={{ width: 600, height: 846, transform: 'scale(0.2)', transformOrigin: 'top left' }}>
          <PageRenderer page={page} bookId={bookId} className="w-full h-full pointer-events-none" />
        </div>
        
        {/* Drag overlay on hover */}
        <div 
          {...listeners}
          {...attributes}
          className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center cursor-grab active:cursor-grabbing backdrop-blur-sm"
        >
          <GripVertical size={24} className="text-white drop-shadow-md" />
        </div>
      </div>

      {/* Label */}
      <div className="text-xs font-bold text-neutral-300">
        Page {page.page_number}
      </div>
      <div className="text-[10px] text-neutral-500 uppercase tracking-widest -mt-1">
        {page.type}
      </div>
    </div>
  )
}

export function PageManagerModal({ onClose }: PageManagerModalProps) {
  const { book, currentPageIndex, setCurrentPageIndex, reorderPages, addPage } = useEditorStore()

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } })
  )

  if (!book?.pages) return null

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const fromIndex = book.pages!.findIndex((p) => p.id === active.id)
    const toIndex = book.pages!.findIndex((p) => p.id === over.id)
    if (fromIndex !== -1 && toIndex !== -1) {
      reorderPages(fromIndex, toIndex)
    }
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-8 bg-black/80 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="bg-neutral-950 border border-neutral-800 rounded-3xl w-full max-w-5xl max-h-[90vh] flex flex-col overflow-hidden shadow-2xl"
          initial={{ scale: 0.95, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.95, opacity: 0, y: 20 }}
          onClick={(e) => e.stopPropagation()}
        >
          <div className="flex items-center justify-between p-6 border-b border-neutral-800 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-white">Visual Page Manager</h2>
              <p className="text-sm text-neutral-400 mt-1">Drag and drop to rearrange your entire book's structure.</p>
            </div>
            <button
              onClick={onClose}
              className="w-10 h-10 rounded-full bg-neutral-900 hover:bg-neutral-800 flex items-center justify-center text-neutral-400 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
            <DndContext
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={handleDragEnd}
            >
              <SortableContext
                items={book.pages.map((p) => p.id)}
                strategy={rectSortingStrategy}
              >
                <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-6">
                  {book.pages.map((page, index) => (
                    <SortableGridPage
                      key={page.id}
                      page={page}
                      bookId={book.id}
                      index={index}
                      isSelected={currentPageIndex === index}
                      onSelect={() => {
                        setCurrentPageIndex(index)
                        onClose()
                      }}
                    />
                  ))}

                  <button
                    onClick={addPage}
                    className="flex flex-col items-center justify-center gap-3 rounded-xl border-2 border-dashed border-neutral-800 hover:border-neutral-600 hover:bg-neutral-900 transition-colors text-neutral-500 hover:text-neutral-300 min-h-[200px]"
                  >
                    <Plus size={32} />
                    <span className="text-xs font-bold uppercase tracking-wider">Add Page</span>
                  </button>
                </div>
              </SortableContext>
            </DndContext>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
