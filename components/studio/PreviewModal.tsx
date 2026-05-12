'use client'

import { useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, ChevronLeft, ChevronRight } from 'lucide-react'
import { useEditorStore } from '@/lib/editor-store'
import { ViewerEngine, type ViewerEngineHandle } from '@/components/viewer/ViewerEngine'

interface PreviewModalProps {
  onClose: () => void
}

export function PreviewModal({ onClose }: PreviewModalProps) {
  const { book } = useEditorStore()
  const viewerRef = useRef<ViewerEngineHandle>(null)

  if (!book) return null

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex flex-col bg-neutral-950/95"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 h-12 shrink-0">
          <span className="text-sm text-neutral-400">
            Preview — {book.title}
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={() => viewerRef.current?.flipPrev()}
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Previous page"
            >
              <ChevronLeft size={18} />
            </button>
            <button
              onClick={() => viewerRef.current?.flipNext()}
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Next page"
            >
              <ChevronRight size={18} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded text-neutral-400 hover:text-white hover:bg-neutral-800 transition-colors"
              title="Close (Esc)"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Viewer */}
        <div className="flex-1 overflow-auto flex items-center justify-center p-4">
          <div className="w-full max-w-5xl">
            <ViewerEngine ref={viewerRef} book={book} />
          </div>
        </div>

        {/* Footer hint */}
        <div className="text-center py-3 text-xs text-neutral-600">
          Use ← → arrow keys to navigate · Press Esc to close
        </div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
