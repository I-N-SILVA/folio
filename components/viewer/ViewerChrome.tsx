'use client'

import { useRef, useState } from 'react'
import { ChevronLeft, ChevronRight, Maximize, Minimize } from 'lucide-react'
import { ViewerEngine, ViewerEngineHandle } from './ViewerEngine'
import { KeyboardHints } from './KeyboardHints'
import type { Book } from '@/lib/book-schema'

export function ViewerChrome({ book, embed = false }: { book: Book; embed?: boolean }) {
  const engineRef = useRef<ViewerEngineHandle>(null)
  const [currentPage, setCurrentPage] = useState(0)
  const [fullscreen, setFullscreen] = useState(false)

  const totalPages = book.pages?.length ?? 0

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen()
      setFullscreen(true)
    } else {
      document.exitFullscreen()
      setFullscreen(false)
    }
  }

  return (
    <div className="flex flex-col items-center gap-4 w-full">
      <ViewerEngine
        ref={engineRef}
        book={book}
        onFlip={setCurrentPage}
        embed={embed}
      />

      {!embed && (
        <div className="flex items-center gap-6 py-3 px-6 rounded-full bg-black/10 backdrop-blur-sm">
          <button
            onClick={() => engineRef.current?.flipPrev()}
            className="p-2 rounded-full hover:bg-black/10 transition-colors disabled:opacity-30 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Previous page"
            disabled={currentPage === 0}
          >
            <ChevronLeft size={20} />
          </button>

          <span className="text-sm font-medium tabular-nums min-w-[80px] text-center">
            {currentPage + 1} / {totalPages}
          </span>

          <button
            onClick={() => engineRef.current?.flipNext()}
            className="p-2 rounded-full hover:bg-black/10 transition-colors disabled:opacity-30 min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label="Next page"
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight size={20} />
          </button>

          <button
            onClick={toggleFullscreen}
            className="p-2 rounded-full hover:bg-black/10 transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={fullscreen ? 'Exit fullscreen' : 'Enter fullscreen'}
          >
            {fullscreen ? <Minimize size={18} /> : <Maximize size={18} />}
          </button>
        </div>
      )}

      {!embed && <KeyboardHints />}

      {/* Accessible page announcements */}
      <div className="sr-only" aria-live="polite">
        Page {currentPage + 1} of {totalPages}
      </div>
    </div>
  )
}
