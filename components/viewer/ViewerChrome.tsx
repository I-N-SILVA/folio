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
    <div className="flex w-full flex-col items-center gap-4">
      <ViewerEngine
        ref={engineRef}
        book={book}
        onFlip={setCurrentPage}
        embed={embed}
      />

      {!embed && (
        <div className="flex items-center gap-3 rounded-full border border-white/50 bg-[#ffffff]/78 px-4 py-3 text-[var(--folio-ink)] shadow-[0_18px_60px_rgba(45,31,15,0.16)] backdrop-blur-xl sm:gap-6 sm:px-6">
          <button
            onClick={() => engineRef.current?.flipPrev()}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-black/10 disabled:opacity-30"
            aria-label="Previous page"
            disabled={currentPage === 0}
          >
            <ChevronLeft size={20} />
          </button>

          <span className="min-w-[80px] text-center text-sm font-extrabold tabular-nums tracking-[0.08em]">
            {currentPage + 1} / {totalPages}
          </span>

          <button
            onClick={() => engineRef.current?.flipNext()}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-black/10 disabled:opacity-30"
            aria-label="Next page"
            disabled={currentPage >= totalPages - 1}
          >
            <ChevronRight size={20} />
          </button>

          <button
            onClick={toggleFullscreen}
            className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-full transition-colors hover:bg-black/10"
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

      {/* Branding */}
      {!book.settings?.whitelabel && (
        <a
          href="https://riffle.app"
          target="_blank"
          rel="noopener noreferrer"
          className="fixed bottom-4 right-4 z-[9000] rounded-full border border-white/50 bg-[#ffffff]/82 px-3 py-1.5 text-xs font-extrabold text-[var(--folio-muted)] shadow-sm backdrop-blur-md transition-colors hover:text-[var(--folio-ink)]"
        >
          Made with <span className="font-display text-[var(--folio-teal)]">Riffle</span>
        </a>
      )}
    </div>
  )
}
