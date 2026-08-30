'use client'

import { useState, useMemo, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, X, ArrowRight, FileText } from 'lucide-react'
import type { Book } from '@/lib/book-schema'

interface SearchResult {
  pageIndex: number
  pageNumber: number
  snippet: string
  matchedTerm: string
  label?: string
}

export function SearchModal({
  isOpen,
  onClose,
  book,
  onSelectPage,
}: {
  isOpen: boolean
  onClose: () => void
  book: Book
  onSelectPage: (pageIndex: number) => void
}) {
  const [query, setQuery] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery('')
    }
  }, [isOpen])

  // Real-time full-text index across all pages
  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q || q.length < 2) return []

    const matches: SearchResult[] = []

    book.pages?.forEach((page, pageIndex) => {
      // Search in text blocks
      page.blocks?.forEach((block) => {
        if (block.type === 'text' && block.content) {
          const lower = block.content.toLowerCase()
          const idx = lower.indexOf(q)
          if (idx !== -1) {
            const start = Math.max(0, idx - 40)
            const end = Math.min(block.content.length, idx + q.length + 40)
            const snippet = (start > 0 ? '…' : '') + block.content.slice(start, end).replace(/[#*_~`]/g, '') + (end < block.content.length ? '…' : '')
            matches.push({
              pageIndex,
              pageNumber: page.page_number,
              snippet,
              matchedTerm: q,
              label: block.variant,
            })
          }
        } else if (block.type === 'image' && block.caption) {
          const lower = block.caption.toLowerCase()
          if (lower.includes(q)) {
            matches.push({
              pageIndex,
              pageNumber: page.page_number,
              snippet: block.caption,
              matchedTerm: q,
              label: 'Image Caption',
            })
          }
        }
      })

      // Search in hotspot pins
      page.hotspots?.forEach((spot) => {
        const spotText = `${spot.label || ''} ${spot.modal?.title || ''} ${spot.modal?.body || ''}`
        if (spotText.toLowerCase().includes(q)) {
          matches.push({
            pageIndex,
            pageNumber: page.page_number,
            snippet: spot.label || spot.modal?.title || spotText.slice(0, 60),
            matchedTerm: q,
            label: 'Interactive Pin',
          })
        }
      })
    })

    return matches
  }, [query, book.pages])

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-start justify-center p-4 sm:p-6 pt-16 sm:pt-24">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/70 backdrop-blur-md"
          />

          {/* Dialog */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96, y: -10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: -10 }}
            transition={{ duration: 0.2 }}
            className="relative z-10 w-full max-w-xl overflow-hidden rounded-2xl border border-neutral-800 bg-[#0c0c0e] text-white shadow-2xl"
          >
            {/* Search Input Bar */}
            <div className="flex items-center gap-3 border-b border-neutral-800 px-4 py-3.5">
              <Search size={18} className="text-zinc-400 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search text, products, or topics in this edition…"
                className="w-full bg-transparent text-sm text-white placeholder-zinc-500 outline-none"
              />
              {query && (
                <button
                  onClick={() => setQuery('')}
                  className="rounded p-1 text-zinc-500 hover:text-white"
                >
                  <X size={14} />
                </button>
              )}
            </div>

            {/* Results Body */}
            <div className="max-h-80 overflow-y-auto p-2">
              {query.trim().length >= 2 && results.length === 0 && (
                <div className="py-10 text-center text-zinc-500">
                  <p className="text-sm">No matches found for &ldquo;{query}&rdquo;</p>
                  <p className="mt-1 text-xs text-zinc-600">Try searching for other keywords or phrases.</p>
                </div>
              )}

              {query.trim().length < 2 && (
                <div className="py-8 text-center text-zinc-500">
                  <p className="text-xs">Type at least 2 characters to search across all pages.</p>
                </div>
              )}

              {results.map((res, i) => (
                <button
                  key={`${res.pageIndex}-${i}`}
                  onClick={() => {
                    onSelectPage(res.pageIndex)
                    onClose()
                  }}
                  className="flex w-full items-start justify-between rounded-xl p-3 text-left transition-colors hover:bg-neutral-800/80 group"
                >
                  <div className="min-w-0 flex-1 pr-3">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="rounded bg-white/10 px-1.5 py-0.5 text-[10px] font-semibold text-zinc-300">
                        Page {res.pageNumber}
                      </span>
                      {res.label && (
                        <span className="text-[10px] uppercase tracking-wider text-zinc-500 font-medium">
                          {res.label}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed line-clamp-2">
                      {res.snippet}
                    </p>
                  </div>
                  <ArrowRight size={14} className="text-zinc-600 group-hover:text-white shrink-0 mt-2 transition-transform group-hover:translate-x-0.5" />
                </button>
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between border-t border-neutral-800/80 bg-black/40 px-4 py-2 text-[11px] text-zinc-500">
              <span>{results.length} result{results.length === 1 ? '' : 's'}</span>
              <span>Press <kbd className="rounded bg-neutral-800 px-1.5 py-0.5 font-mono text-[10px] text-zinc-400">Esc</kbd> to close</span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
