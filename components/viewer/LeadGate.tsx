'use client'

import { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { Loader2, Lock } from 'lucide-react'
import { trackEvent } from '@/lib/tracking'
import type { Gating } from '@/lib/book-schema'

interface LeadGateProps {
  gating?: Gating
  /** Needed to attribute the gate_view that gives unlocks a denominator. */
  bookId: string
  /** How many pages are being withheld, for the "N more pages" line. */
  lockedCount: number
  slug: string
  sessionId: string
  /** Receives the pages the server released. */
  onUnlocked: (pages: unknown[]) => void
}

/**
 * Rendered as the final page of a gated edition, in place of the content that
 * the server withheld. It was previously an overlay blurring pages that had
 * already been sent to the browser, which meant the gate could be removed in
 * devtools and the edition read in full.
 */
export function LeadGate({
  gating,
  bookId,
  lockedCount,
  slug,
  sessionId,
  onUnlocked,
}: LeadGateProps) {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  // Unlocks were being counted with no denominator, so "12 leads" said nothing
  // about whether the gate converts. Recorded once per mount — the gate is one
  // page of a flipbook, so it mounts when the edition loads, not on every flip.
  const reported = useRef(false)
  useEffect(() => {
    if (reported.current) return
    reported.current = true
    trackEvent(bookId, 'gate_view', { page_number: gating?.page_number ?? 3 })
  }, [bookId, gating?.page_number])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!email.trim() || busy) return

    setBusy(true)
    setError('')
    try {
      const res = await fetch('/api/books/unlock', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug, email: email.trim(), sessionId }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        throw new Error(typeof data.error === 'string' ? data.error : 'Something went wrong.')
      }
      onUnlocked(Array.isArray(data.pages) ? data.pages : [])
    } catch (err) {
      // The email is the asset being exchanged, so a failure has to be visible
      // and retryable rather than silently unlocking or silently dropping it.
      setError(err instanceof Error ? err.message : 'Something went wrong.')
      setBusy(false)
    }
  }

  return (
    <div className="flex h-full w-full items-center justify-center bg-[var(--qlico-vellum)] p-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.35, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-sm space-y-5 rounded-2xl border border-black/5 bg-white p-7 text-center shadow-xl"
      >
        <span className="mx-auto grid h-11 w-11 place-items-center rounded-full bg-[var(--accent)]/10 text-[var(--accent)]">
          <Lock size={19} />
        </span>

        {/* Both strings are optional in the schema, so an edition that switched
            gating on without filling them in used to render a blank card. */}
        <div className="space-y-2">
          <h3 className="text-xl font-bold leading-tight text-gray-900">
            {gating?.title || 'Read the rest of this edition'}
          </h3>
          <p className="text-sm leading-6 text-gray-600">
            {gating?.description || 'Enter your email to unlock the remaining pages.'}
          </p>
          {lockedCount > 0 && (
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-gray-400">
              {lockedCount} more {lockedCount === 1 ? 'page' : 'pages'}
            </p>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            aria-label="Email address"
            aria-invalid={Boolean(error)}
            value={email}
            onChange={(e) => {
              setEmail(e.target.value)
              setError('')
            }}
            disabled={busy}
            placeholder="your@email.com"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 text-sm outline-none transition-all focus:border-transparent focus:ring-2 focus:ring-[var(--accent)] disabled:opacity-60"
          />
          {/* `bg-primary` was never a real utility — no --color-primary is
              registered with Tailwind's theme — so this button rendered with a
              transparent background under white text and was invisible. */}
          <button
            type="submit"
            disabled={busy}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--accent)] py-3 font-semibold text-white shadow-lg transition-all hover:bg-[var(--accent-hover)] active:scale-[0.98] disabled:opacity-70"
          >
            {busy && <Loader2 size={15} className="animate-spin" />}
            {busy ? 'Unlocking…' : 'Unlock full edition'}
          </button>
        </form>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
          </p>
        )}

        <p className="text-[10px] text-gray-400">We respect your privacy. No spam, ever.</p>
      </motion.div>
    </div>
  )
}
