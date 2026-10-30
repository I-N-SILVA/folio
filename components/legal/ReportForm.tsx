'use client'

import { useState } from 'react'
import { REPORT_REASONS } from '@/lib/abuse'

const field =
  'mt-2 w-full rounded-2xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)] px-4 py-3 text-[15px] text-[var(--qlico-ink)] outline-none focus:border-[var(--qlico-ink)]'
const label = 'block text-sm font-bold text-[var(--qlico-ink)]'

export function ReportForm({ initialEdition }: { initialEdition: string }) {
  const [edition, setEdition] = useState(initialEdition)
  const [reason, setReason] = useState('')
  const [details, setDetails] = useState('')
  const [email, setEmail] = useState('')
  const [state, setState] = useState<'idle' | 'sending' | 'sent'>('idle')
  const [error, setError] = useState<string | null>(null)

  async function submit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    if (!reason) {
      setError('Choose a reason for the report.')
      return
    }
    setState('sending')
    try {
      const res = await fetch('/api/report', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ edition: edition.trim(), reason, details, email }),
      })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        setError(data.error || 'The report could not be sent. Please try again.')
        setState('idle')
        return
      }
      setState('sent')
    } catch {
      setError('The report could not be sent. Check your connection and try again.')
      setState('idle')
    }
  }

  if (state === 'sent') {
    return (
      <div
        role="status"
        className="rounded-[1.5rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/80 p-6"
      >
        <p className="font-display text-2xl font-semibold tracking-[-0.03em]">
          Thank you — we have it.
        </p>
        <p className="mt-2 text-[15px] leading-7 text-[var(--qlico-muted)]">
          Someone will look at this edition. If it is harmful it will be taken offline; you will
          hear back only if you left an email and we need more from you.
        </p>
      </div>
    )
  }

  return (
    <form onSubmit={submit} className="space-y-6" noValidate>
      <div>
        <label htmlFor="report-edition" className={label}>
          Edition link name
        </label>
        <input
          id="report-edition"
          className={field}
          value={edition}
          onChange={(e) => setEdition(e.target.value)}
          placeholder="the part after /book/ in the address"
          required
          autoComplete="off"
        />
      </div>

      <fieldset>
        <legend className={label}>What is wrong with it?</legend>
        <div className="mt-3 space-y-2">
          {REPORT_REASONS.map((r) => (
            <label
              key={r.value}
              className="flex items-start gap-3 text-[15px] leading-6 text-[var(--qlico-ink)]"
            >
              <input
                type="radio"
                name="reason"
                value={r.value}
                checked={reason === r.value}
                onChange={() => setReason(r.value)}
                className="mt-1"
              />
              {r.label}
            </label>
          ))}
        </div>
      </fieldset>

      <div>
        <label htmlFor="report-details" className={label}>
          Anything that helps us check{' '}
          <span className="font-normal text-[var(--qlico-muted)]">(optional)</span>
        </label>
        <textarea
          id="report-details"
          className={`${field} min-h-28`}
          value={details}
          maxLength={2000}
          onChange={(e) => setDetails(e.target.value)}
          placeholder="Which page, what it asked you for, where the link sent you."
        />
      </div>

      <div>
        <label htmlFor="report-email" className={label}>
          Your email{' '}
          <span className="font-normal text-[var(--qlico-muted)]">
            (optional — only if we may contact you)
          </span>
        </label>
        <input
          id="report-email"
          type="email"
          className={field}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          autoComplete="email"
        />
      </div>

      {error && (
        <p role="alert" className="text-sm font-semibold text-[#8a2b26]">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={state === 'sending'}
        className="rounded-full bg-[var(--accent)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent-contrast)] transition hover:bg-[var(--accent-hover)] disabled:opacity-50"
      >
        {state === 'sending' ? 'Sending…' : 'Send report'}
      </button>
    </form>
  )
}
