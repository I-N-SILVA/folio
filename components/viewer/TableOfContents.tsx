'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { X, BookOpen, Layers } from 'lucide-react'
import type { Book } from '@/lib/book-schema'
import { PageRenderer } from '@/components/viewer/PageRenderer'

interface TableOfContentsProps {
  book: Book
  currentPage: number
  onSelectPage: (index: number) => void
  onClose: () => void
}

export function TableOfContents({
  book,
  currentPage,
  onSelectPage,
  onClose,
}: TableOfContentsProps) {
  const pages = book.pages ?? []

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[9600] flex items-end sm:items-center justify-center p-0 sm:p-6">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/60 backdrop-blur-md"
        />

        {/* Modal / Drawer Content */}
        <motion.div
          initial={{ y: 50, opacity: 0, scale: 0.96 }}
          animate={{ y: 0, opacity: 1, scale: 1 }}
          exit={{ y: 50, opacity: 0, scale: 0.96 }}
          transition={{ type: 'spring', damping: 26, stiffness: 300 }}
          className="relative max-h-[85vh] w-full max-w-4xl overflow-hidden rounded-t-[2rem] sm:rounded-[2rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)] p-6 shadow-2xl flex flex-col z-10"
        >
          {/* Header */}
          <div className="flex items-center justify-between border-b border-[var(--qlico-border)] pb-4">
            <div className="flex items-center gap-3">
              <div className="grid h-9 w-9 place-items-center rounded-xl bg-[var(--tint-weak)] text-[var(--qlico-ink)]">
                <Layers size={18} />
              </div>
              <div>
                <h2 className="font-display text-xl font-semibold tracking-[-0.02em] text-[var(--qlico-ink)]">
                  Table of Contents
                </h2>
                <p className="text-xs text-[var(--qlico-muted)]">
                  {book.title} · {pages.length} {pages.length === 1 ? 'page' : 'pages'}
                </p>
              </div>
            </div>

            <button
              onClick={onClose}
              className="rounded-full p-2 text-[var(--qlico-muted)] transition hover:bg-[var(--tint-weak)] hover:text-[var(--qlico-ink)]"
              aria-label="Close table of contents"
            >
              <X size={20} />
            </button>
          </div>

          {/* Page Grid */}
          <div className="flex-1 overflow-y-auto pt-4 pb-2">
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
              {pages.map((page, index) => {
                const isActive = currentPage === index
                const titleBlock = page.blocks?.find(
                  (b) => b.type === 'text' && (b as { variant?: string }).variant === 'title'
                ) as { content?: string } | undefined
                const pageTitle = titleBlock?.content || `Page ${index + 1}`

                return (
                  <button
                    key={page.id || index}
                    onClick={() => {
                      onSelectPage(index)
                      onClose()
                    }}
                    className={`group relative flex flex-col items-center rounded-2xl border p-2.5 text-left transition-all ${
                      isActive
                        ? 'border-[var(--accent)] bg-[var(--accent)]/5 shadow-md ring-2 ring-[var(--accent)]'
                        : 'border-[var(--qlico-border)] bg-[var(--qlico-subtle)] hover:-translate-y-1 hover:border-[var(--qlico-ink)]'
                    }`}
                  >
                    <div className="relative aspect-[1/1.41] w-full overflow-hidden rounded-xl border border-[var(--qlico-border)] bg-white shadow-xs">
                      {/* Mini preview container */}
                      <div className="pointer-events-none absolute inset-0 origin-top-left scale-[0.28] w-[357%] h-[357%]">
                        <PageRenderer page={page} bookId={book.id} theme={book.theme} />
                      </div>

                      {isActive && (
                        <div className="absolute inset-0 bg-[var(--accent)]/10 flex items-center justify-center">
                          <span className="rounded-full bg-[var(--accent)] px-2.5 py-1 text-[10px] font-bold text-[var(--accent-contrast)] shadow-md">
                            Reading
                          </span>
                        </div>
                      )}
                    </div>

                    <div className="mt-2 flex w-full items-center justify-between gap-1 px-1">
                      <span className="text-[11px] font-bold text-[var(--qlico-ink)]">
                        Page {index + 1}
                      </span>
                      <span className="truncate text-[10px] text-[var(--qlico-muted)]">
                        {page.type}
                      </span>
                    </div>
                  </button>
                )
              })}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  )
}
