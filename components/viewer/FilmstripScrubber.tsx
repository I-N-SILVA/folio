'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { Book, Page } from '@/lib/book-schema'

export function FilmstripScrubber({
  book,
  currentPage,
  onSelectPage,
}: {
  book: Book
  currentPage: number
  onSelectPage: (pageIndex: number) => void
}) {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  const pages = book.pages ?? []
  if (pages.length <= 1) return null

  return (
    <div className="relative mx-auto mt-2 w-full max-w-2xl px-4 select-none">
      <div
        ref={containerRef}
        className="group relative flex items-center justify-center gap-1.5 rounded-full border border-white/10 bg-black/50 p-2 backdrop-blur-xl transition-all duration-300 hover:border-white/20 hover:bg-black/80 hover:p-3"
      >
        {pages.map((page, idx) => {
          const isActive = idx === currentPage || idx === currentPage + 1
          const isCover = page.type === 'cover'
          const bgColor = page.background?.color || '#ffffff'

          return (
            <button
              key={page.id}
              onClick={() => onSelectPage(idx)}
              onMouseEnter={() => setHoveredIndex(idx)}
              onMouseLeave={() => setHoveredIndex(null)}
              aria-label={`Jump to page ${page.page_number}`}
              className={`relative flex flex-col items-center transition-all duration-200 ${
                isActive
                  ? 'scale-110 opacity-100 z-10'
                  : 'opacity-40 hover:opacity-90 hover:scale-105'
              }`}
            >
              {/* Mini Page Thumbnail */}
              <div
                className={`h-8 w-6 rounded-[3px] border shadow-sm transition-all ${
                  isActive
                    ? 'border-white ring-2 ring-white/30 shadow-lg'
                    : 'border-white/20'
                }`}
                style={{ backgroundColor: isCover ? '#18181b' : bgColor }}
              >
                {/* Visual miniature layout bars */}
                <div className="flex h-full w-full flex-col justify-between p-0.5 opacity-60">
                  <div className={`h-1 w-2 rounded-full ${isCover ? 'bg-white/40' : 'bg-black/40'}`} />
                  <div className={`h-0.5 w-full rounded-full ${isCover ? 'bg-white/20' : 'bg-black/20'}`} />
                </div>
              </div>

              {/* Page Number Label */}
              <span className={`mt-1 font-mono text-[9px] tabular-nums font-semibold transition-colors ${
                isActive ? 'text-white' : 'text-zinc-400'
              }`}>
                {page.page_number}
              </span>
            </button>
          )
        })}

        {/* Hover Tooltip Preview */}
        <AnimatePresence>
          {hoveredIndex !== null && pages[hoveredIndex] && (
            <motion.div
              initial={{ opacity: 0, y: 10, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 10, scale: 0.95 }}
              transition={{ duration: 0.15 }}
              className="pointer-events-none absolute -top-16 z-50 rounded-xl border border-white/15 bg-neutral-900/95 px-3 py-1.5 text-center text-white shadow-2xl backdrop-blur-md"
            >
              <p className="text-[10px] font-semibold uppercase tracking-wider text-zinc-400">
                Page {pages[hoveredIndex].page_number}
              </p>
              <p className="font-display truncate max-w-[140px] text-xs font-medium text-white">
                {pages[hoveredIndex].blocks?.find((b) => b.type === 'text')?.content?.slice(0, 24)?.replace(/#+/g, '') || `Spread ${hoveredIndex + 1}`}
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
