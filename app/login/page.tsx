'use client'

import { useState } from 'react'
import { createBrowserSupabase } from '@/lib/supabase'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const supabase = createBrowserSupabase()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
    }
    setLoading(false)
  }

  return (
    <main className="folio-grain flex min-h-screen items-center justify-center bg-[var(--background)] p-6 text-[var(--folio-ink)]">
      <div className="w-full max-w-md rounded-[2.25rem] border border-[var(--folio-border)] bg-[#fff8ec]/80 p-8 shadow-[var(--folio-shadow)] backdrop-blur">
        <div className="mb-8">
          <p className="mb-3 text-xs font-extrabold uppercase tracking-[0.24em] text-[var(--folio-teal)]">
            Creator Studio
          </p>
          <h1 className="font-display text-5xl font-semibold tracking-[-0.07em]">Folio</h1>
          <p className="mt-3 text-sm leading-6 text-[var(--folio-muted)]">
            Sign in with a magic link to compose, publish, and measure your digital shelf.
          </p>
        </div>

        {sent ? (
          <div className="rounded-[1.5rem] border border-green-200 bg-green-50 p-6">
            <h2 className="mb-1 font-semibold text-green-800">Check your email</h2>
            <p className="text-sm text-green-700">
              We sent a magic link to <strong>{email}</strong>. Click it to sign in.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-extrabold uppercase tracking-[0.14em] text-[var(--folio-muted)]">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-[var(--folio-border)] bg-white/70 px-4 py-3 text-sm outline-none transition focus:border-[var(--folio-teal)] focus:ring-4 focus:ring-[var(--folio-teal)]/10"
              />
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[var(--folio-teal)] py-3.5 font-extrabold uppercase tracking-[0.16em] text-white shadow-[0_16px_34px_rgba(13,102,97,0.22)] transition hover:-translate-y-0.5 hover:bg-[#09514d] disabled:translate-y-0 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </div>
    </main>
  )
}
