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
          {/* Both fields are author-supplied and optional in the schema, so an
              edition that enabled gating without filling them in would have
              rendered a card with no heading and no explanation. */}
          <div className="space-y-2">
            <h3 className="text-2xl font-bold leading-tight text-gray-900">
              {gating.title || 'Read the rest of this edition'}
            </h3>
            <p className="text-sm text-gray-600">
              {gating.description || 'Enter your email to unlock the remaining pages.'}
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
            {/* `bg-primary` / `ring-primary` were never real utilities — no
                --color-primary is registered with Tailwind's theme, so the
                submit button rendered with a transparent background under white
                text and was completely invisible on the white card. The author's
                theme colour is an inline variable on the page element, which
                this overlay is a sibling of rather than a child, so it needs the
                app accent as a fallback for when that variable isn't in scope. */}
            <input
              name="email"
              type="email"
              required
              autoComplete="email"
              aria-label="Email address"
              placeholder="your@email.com"
              className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[var(--primary,var(--accent))]"
            />
            <button
              type="submit"
              className="w-full rounded-xl bg-[var(--primary,var(--accent))] py-3 font-semibold text-white shadow-lg transition-all hover:opacity-90 active:scale-[0.98]"
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
