'use client'

import { Suspense, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { track } from '@vercel/analytics'
import { useSearchParams } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resent, setResent] = useState(false)

  // The auth callback redirects here with a reason when a magic link fails, so
  // an expired or reused link explains itself instead of looking like a bug.
  const linkError = useSearchParams().get('error')
  const linkMessage =
    linkError === 'link_expired'
      ? 'That sign-in link has expired. Send yourself a new one.'
      : linkError === 'link_invalid'
        ? "That sign-in link didn't work — it may already have been used. Send a new one."
        : ''

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setError('')

    // Honor an optional ?next= target so post-login flows (e.g. upgrade) land
    // on the right page. Only allow same-origin relative paths — and `//host`
    // is not one: browsers read it as a protocol-relative absolute URL, so
    // startsWith('/') alone would have carried ?next=//evil.com through. The
    // callback rejects it too, but the two checks should agree.
    const rawNext = new URLSearchParams(window.location.search).get('next')
    const next =
      rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null
    const redirectTo = `${window.location.origin}/auth/callback${
      next ? `?next=${encodeURIComponent(next)}` : ''
    }`

    const supabase = createBrowserSupabase()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: redirectTo },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
      track('signup_magic_link_sent')
    }
    setLoading(false)
  }

  return (
    <main className="qlico-grain flex min-h-screen items-center justify-center bg-[var(--background)] p-6 text-[var(--qlico-ink)]">
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        className="w-full max-w-md rounded-[2.25rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/80 p-8 shadow-[var(--qlico-shadow)] backdrop-blur"
      >
        <div className="mb-8">
          <p className="mb-3 text-xs font-semibold uppercase tracking-[0.24em] text-[var(--qlico-teal)]">
            Creator Studio
          </p>
          <h1>
            <span className="sr-only">QLICO</span>
            <Image src="/brand/qlico-logo.png" alt="" width={181} height={50} priority className="theme-light-only h-[50px] w-auto object-contain" />
            <Image src="/brand/qlico-logo-white.png" alt="" width={181} height={50} priority className="theme-dark-only h-[50px] w-auto object-contain" />
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--qlico-muted)]">
            Sign in with a magic link to compose, publish, and measure your digital shelf.
          </p>
        </div>

        {sent ? (
          <div>
            <div className="rounded-[1.5rem] border border-green-200 bg-green-50 p-6">
              <h2 className="mb-1 font-semibold text-green-800">Check your email</h2>
              <p className="text-sm text-green-700">
                We sent a magic link to <strong>{email}</strong>. Click it to sign in.
              </p>
              <p className="mt-3 text-xs leading-5 text-green-700/80">
                It can take a minute to arrive. Check your spam folder if it doesn&apos;t.
              </p>
            </div>

            {/* A typo'd address used to be a dead end — the only way out was a
                page reload. */}
            <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm">
              <button
                type="button"
                onClick={() => {
                  setSent(false)
                  setResent(false)
                  setError('')
                }}
                className="font-semibold text-[var(--accent-fg)] underline underline-offset-4 hover:text-[var(--accent-hover)]"
              >
                Use a different email
              </button>
              <button
                type="button"
                disabled={loading || resent}
                onClick={async () => {
                  await handleSubmit()
                  setResent(true)
                }}
                className="font-semibold text-[var(--qlico-muted)] underline underline-offset-4 transition hover:text-[var(--qlico-ink)] disabled:no-underline disabled:opacity-60"
              >
                {loading ? 'Sending…' : resent ? 'Link resent' : 'Resend link'}
              </button>
            </div>

            {error && (
              <p className="mt-3 text-sm text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div>
              <label htmlFor="email" className="mb-2 block text-sm font-semibold uppercase tracking-[0.14em] text-[var(--qlico-muted)]">
                Email address
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="you@example.com"
                className="w-full rounded-2xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/70 px-4 py-3 text-sm outline-none transition focus:border-[var(--qlico-teal)] focus:ring-4 focus:ring-[var(--qlico-teal)]/10"
              />
            </div>

            {(error || linkMessage) && (
              <p className="text-sm text-red-600" role="alert">
                {error || linkMessage}
              </p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="rounded-full bg-[var(--accent)] py-3.5 font-semibold uppercase tracking-[0.16em] text-white shadow-[0_16px_34px_rgba(60,35,132,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] disabled:translate-y-0 disabled:opacity-50"
            >
              {loading ? 'Sending…' : 'Send magic link'}
            </button>
          </form>
        )}
      </motion.div>
    </main>
  )
}

export default function LoginPage() {
  // useSearchParams requires a suspense boundary, or the whole route opts into
  // client-side rendering.
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
