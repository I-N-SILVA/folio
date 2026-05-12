'use client'

import { useState } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Copy, Check, Code } from 'lucide-react'

interface ShareModalProps {
  slug: string
  onClose: () => void
}

export function ShareModal({ slug, onClose }: ShareModalProps) {
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [copiedEmbed, setCopiedEmbed] = useState(false)

  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = `${origin}/book/${slug}`
  const embedCode = `<iframe src="${origin}/embed/${slug}" width="100%" height="600" frameborder="0" allowfullscreen></iframe>`

  async function copyText(text: string, setCopied: (v: boolean) => void) {
    await navigator.clipboard.writeText(text)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />
        <motion.div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          role="dialog"
          aria-modal="true"
          aria-label="Share book"
        >
          <button
            className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={18} />
          </button>

          <h2 className="text-lg font-bold mb-5">Share this book</h2>

          {/* Direct URL */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              Direct Link
            </label>
            <div className="flex items-center gap-2 border border-gray-200 rounded-lg p-2 bg-gray-50">
              <span className="flex-1 text-sm font-mono truncate text-gray-700">{url}</span>
              <button
                onClick={() => copyText(url, setCopiedUrl)}
                className="flex-shrink-0 p-1.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors"
                aria-label="Copy link"
              >
                {copiedUrl ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
              </button>
            </div>
          </div>

          {/* Embed Code */}
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              Embed Code
            </label>
            <div className="border border-gray-200 rounded-lg p-3 bg-gray-50">
              <div className="flex items-start gap-2">
                <Code size={14} className="text-gray-400 mt-0.5 flex-shrink-0" />
                <code className="flex-1 text-xs text-gray-600 break-all leading-relaxed">{embedCode}</code>
                <button
                  onClick={() => copyText(embedCode, setCopiedEmbed)}
                  className="flex-shrink-0 p-1.5 rounded text-gray-500 hover:text-gray-800 hover:bg-gray-200 transition-colors"
                  aria-label="Copy embed code"
                >
                  {copiedEmbed ? <Check size={14} className="text-green-600" /> : <Copy size={14} />}
                </button>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
