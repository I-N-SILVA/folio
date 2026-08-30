'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, X, Send, CheckCircle2, User, Clock } from 'lucide-react'

export interface ReviewComment {
  id: string
  pageNumber: number
  author: string
  text: string
  timestamp: string
  resolved: boolean
}

export function ReviewDrawer({
  isOpen,
  onClose,
  currentPageNumber,
  comments,
  onAddComment,
  onResolveComment,
}: {
  isOpen: boolean
  onClose: () => void
  currentPageNumber: number
  comments: ReviewComment[]
  onAddComment: (comment: { author: string; text: string; pageNumber: number }) => void
  onResolveComment: (id: string) => void
}) {
  const [authorName, setAuthorName] = useState('')
  const [commentText, setCommentText] = useState('')

  const handleSend = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!commentText.trim()) return
    onAddComment({
      author: authorName.trim() || 'Reviewer',
      text: commentText.trim(),
      pageNumber: currentPageNumber,
    })
    setCommentText('')
  }

  const pageComments = comments.filter((c) => c.pageNumber === currentPageNumber)

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex justify-end">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />

          {/* Drawer */}
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 300 }}
            className="relative z-10 flex h-full w-full max-w-md flex-col border-l border-neutral-800 bg-[#09090b] p-6 text-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
              <div className="flex items-center gap-2">
                <MessageSquare size={18} className="text-amber-400" />
                <h2 className="font-display text-lg font-semibold tracking-tight">Feedback & Review</h2>
                <span className="rounded-full bg-amber-400/10 px-2 py-0.5 text-xs font-semibold text-amber-400">
                  Page {currentPageNumber}
                </span>
              </div>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
                aria-label="Close review panel"
              >
                <X size={16} />
              </button>
            </div>

            {/* Comments List */}
            <div className="flex-1 overflow-y-auto py-4 space-y-3">
              {pageComments.length === 0 ? (
                <div className="flex h-full flex-col items-center justify-center text-center text-zinc-500">
                  <MessageSquare size={36} className="mb-3 opacity-30" />
                  <p className="text-sm font-medium">No notes on Page {currentPageNumber}</p>
                  <p className="mt-1 text-xs text-zinc-600">Leave proofing feedback or editorial change requests below.</p>
                </div>
              ) : (
                pageComments.map((c) => (
                  <div
                    key={c.id}
                    className={`rounded-xl border p-4 transition-colors ${
                      c.resolved
                        ? 'border-neutral-800/50 bg-neutral-950/40 opacity-50'
                        : 'border-neutral-800 bg-neutral-900/60'
                    }`}
                  >
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="grid h-5 w-5 place-items-center rounded-full bg-white/10 text-zinc-300">
                          <User size={11} />
                        </div>
                        <span className="text-xs font-semibold text-zinc-200">{c.author}</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] text-zinc-500">{c.timestamp}</span>
                        {!c.resolved && (
                          <button
                            onClick={() => onResolveComment(c.id)}
                            title="Mark as resolved"
                            className="rounded p-1 text-zinc-500 hover:text-green-400"
                          >
                            <CheckCircle2 size={13} />
                          </button>
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-zinc-300 leading-relaxed">{c.text}</p>
                  </div>
                ))
              )}
            </div>

            {/* Comment Submission Form */}
            <form onSubmit={handleSend} className="border-t border-neutral-800 pt-4 space-y-3">
              <input
                type="text"
                value={authorName}
                onChange={(e) => setAuthorName(e.target.value)}
                placeholder="Your name / role (e.g. Art Director)"
                className="w-full rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white placeholder-zinc-500 outline-none focus:border-zinc-500"
              />
              <div className="flex gap-2">
                <textarea
                  value={commentText}
                  onChange={(e) => setCommentText(e.target.value)}
                  placeholder={`Leave feedback for Page ${currentPageNumber}…`}
                  rows={2}
                  className="flex-1 rounded-lg border border-neutral-800 bg-neutral-900 p-2.5 text-xs text-white placeholder-zinc-500 outline-none resize-none focus:border-zinc-500"
                />
                <button
                  type="submit"
                  disabled={!commentText.trim()}
                  className="flex items-center justify-center rounded-lg bg-white px-4 text-black transition-colors hover:bg-zinc-200 disabled:opacity-40"
                  aria-label="Send feedback"
                >
                  <Send size={14} />
                </button>
              </div>
            </form>
          </motion.aside>
        </div>
      )}
    </AnimatePresence>
  )
}
