'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'

const HINTS = [
  { key: '← →', desc: 'Previous / Next page' },
  { key: 'Esc', desc: 'Close modal' },
  { key: '?', desc: 'Show keyboard shortcuts' },
]

export function KeyboardHints() {
  const [open, setOpen] = useState(false)

  useEffect(() => {
    function handler(e: KeyboardEvent) {
      if (e.key === '?' && !e.ctrlKey && !e.metaKey) setOpen((v) => !v)
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  return (
    <>
      {/* Hint trigger button */}
      <button
        onClick={() => setOpen(true)}
        className="fixed bottom-4 right-4 w-8 h-8 rounded-full bg-black/30 hover:bg-black/50 text-white text-sm font-medium flex items-center justify-center backdrop-blur-sm transition-colors z-40"
        aria-label="Keyboard shortcuts"
        title="Keyboard shortcuts (?)"
      >
        ?
      </button>

      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && (
            <motion.div
              className="fixed inset-0 z-[9997] flex items-end sm:items-center justify-center p-4"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
              <motion.div
                className="relative bg-white rounded-2xl shadow-xl p-6 w-full max-w-sm"
                initial={{ y: 20, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 20, opacity: 0 }}
              >
                <button
                  className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
                  onClick={() => setOpen(false)}
                >
                  <X size={16} />
                </button>
                <h3 className="font-semibold text-gray-900 mb-4">Keyboard shortcuts</h3>
                <div className="space-y-3">
                  {HINTS.map(({ key, desc }) => (
                    <div key={key} className="flex items-center justify-between">
                      <span className="text-sm text-gray-600">{desc}</span>
                      <kbd className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded font-mono border border-gray-200">
                        {key}
                      </kbd>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>,
        document.body
      )}
    </>
  )
}
