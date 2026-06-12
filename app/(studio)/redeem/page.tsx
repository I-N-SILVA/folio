'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Gift, Loader2 } from 'lucide-react'

export default function RedeemPage() {
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [success, setSuccess] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!code.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/appsumo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim() }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong.')
        setLoading(false)
        return
      }
      setSuccess(data.planName ?? 'your plan')
      setTimeout(() => router.push('/account'), 1400)
    } catch {
      setError('Network error. Please try again.')
      setLoading(false)
    }
  }

  return (
    <main className="folio-grain flex min-h-screen items-center justify-center bg-[var(--background)] p-6 text-[var(--folio-ink)]">
      <div className="w-full max-w-md rounded-[2.25rem] border border-[var(--folio-border)] bg-[#fff8ec]/80 p-8 shadow-[var(--folio-shadow)] backdrop-blur">
        <div className="mb-7">
          <span className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--folio-ink)] text-[#d6aa66] shadow-lg">
            <Gift size={22} />
          </span>
          <h1 className="mt-5 font-display text-4xl font-semibold tracking-[-0.05em]">Redeem your deal</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--folio-muted)]">
            Paste the license code from your AppSumo purchase to unlock your lifetime tier.
          </p>
        </div>

        {success ? (
          <div className="rounded-[1.5rem] border border-green-200 bg-green-50 p-6">
            <h2 className="mb-1 font-semibold text-green-800">You're all set 🎉</h2>
            <p className="text-sm text-green-700">
              <strong>{success}</strong> is now active. Taking you to your account…
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="code" className="mb-2 block text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--folio-muted)]">
                License code
              </label>
              <input
                id="code"
                type="text"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                placeholder="e.g. AS-XXXX-XXXX-XXXX"
                autoComplete="off"
                spellCheck={false}
                className="w-full rounded-[1.1rem] border border-[var(--folio-border)] bg-white/70 px-4 py-3 font-mono text-sm tracking-wide outline-none transition focus:border-[var(--folio-teal)] focus:ring-2 focus:ring-[var(--folio-teal)]/20"
              />
            </div>

            {error && (
              <p className="rounded-[1rem] border border-red-200 bg-red-50 px-4 py-3 text-sm font-semibold text-red-700">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={loading || !code.trim()}
              className="flex items-center justify-center gap-2 rounded-full bg-[var(--folio-teal)] px-5 py-3.5 text-sm font-extrabold uppercase tracking-[0.14em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#09514d] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading && <Loader2 size={16} className="animate-spin" />}
              {loading ? 'Redeeming…' : 'Redeem code'}
            </button>

            <Link href="/account" className="text-center text-sm font-bold text-[var(--folio-muted)] hover:text-[var(--folio-ink)]">
              Back to account
            </Link>
          </form>
        )}
      </div>
    </main>
  )
}
