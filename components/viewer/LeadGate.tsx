'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { trackEvent } from '@/lib/tracking'
import type { Gating } from '@/lib/book-schema'

interface LeadGateProps {
  gating: Gating
  isUnlocked: boolean
  onUnlock: () => void
  bookId: string
  pageIndex: number
}

export function LeadGate({ gating, isUnlocked, onUnlock, bookId, pageIndex }: LeadGateProps) {
  if (!gating || !gating.enabled || isUnlocked || pageIndex < (gating.page_number ?? 3)) {
    return null
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 z-50 flex items-center justify-center p-8 backdrop-blur-xl bg-white/30 transition-all duration-700"
      >
        <motion.div
          initial={{ scale: 0.9, opacity: 0, y: 20 }}
          animate={{ scale: 1, opacity: 1, y: 0 }}
          exit={{ scale: 0.9, opacity: 0, y: 20 }}
          transition={{ type: 'spring', damping: 25, stiffness: 200 }}
          className="bg-white/90 p-8 rounded-2xl shadow-2xl border border-white/50 max-w-sm w-full text-center space-y-6"
        >
          <div className="space-y-2">
            <h3 className="text-2xl font-bold text-gray-900 leading-tight">
              {gating.title}
            </h3>
            <p className="text-gray-600 text-sm">
              {gating.description}
            </p>
          </div>

          <form
            onSubmit={(e) => {
              e.preventDefault()
              const email = (e.currentTarget.elements.namedItem('email') as HTMLInputElement).value
              if (email) {
                trackEvent(bookId, 'gate_unlock', { email, page_number: pageIndex + 1 })
                onUnlock()
              }
            }}
            className="space-y-4"
          >
            <input
              name="email"
              type="email"
              required
              placeholder="your@email.com"
              className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
            />
            <button
              type="submit"
              className="w-full bg-primary text-white font-semibold py-3 rounded-xl shadow-lg hover:shadow-primary/20 hover:scale-[1.02] active:scale-[0.98] transition-all"
            >
              Unlock Full Content
            </button>
          </form>

          <p className="text-[10px] text-gray-400">
            We respect your privacy. No spam, ever.
          </p>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
