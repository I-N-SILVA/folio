'use client'

import { Suspense, useState } from 'react'
import Image from 'next/image'
import { motion } from 'framer-motion'
import { trackProduct } from '@/lib/product-analytics'
import { useSearchParams } from 'next/navigation'
import { createBrowserSupabase } from '@/lib/supabase'

function LoginForm() {
  const [email, setEmail] = useState('')
  const [sent, setSent] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [resent, setResent] = useState(false)

  const searchParams = useSearchParams()
  const linkError = searchParams.get('error')
  const nextParam = searchParams.get('next')
  const isResuming = nextParam?.includes('resume=1') || nextParam?.includes('new=1')

  const linkMessage =
    linkError === 'link_expired'
      ? 'That sign-in link has expired. Send yourself a new one.'
      : linkError === 'link_invalid'
        ? "That sign-in link didn't work — it may already have been used. Send a new one."
        : ''

  function getRedirectTo() {
    const rawNext = new URLSearchParams(window.location.search).get('next')
    const next = rawNext && rawNext.startsWith('/') && !rawNext.startsWith('//') ? rawNext : null
    return `${window.location.origin}/auth/callback${next ? `?next=${encodeURIComponent(next)}` : ''}`
  }

  async function handleGoogleSignIn() {
    const supabase = createBrowserSupabase()
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getRedirectTo() },
    })
  }

  async function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault()
    setLoading(true)
    setError('')
    trackProduct('signup_started')

    const supabase = createBrowserSupabase()
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: getRedirectTo() },
    })

    if (error) {
      setError(error.message)
    } else {
      setSent(true)
      trackProduct('signup_magic_link_sent')
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
            {isResuming ? 'Save your edition' : 'Creator Studio'}
          </p>
          <h1>
            <span className="sr-only">QLICO</span>
            <Image src="/brand/logo-light.svg" alt="" width={181} height={50} priority className="theme-light-only h-[50px] w-auto object-contain" />
            <Image src="/brand/logo-dark.svg" alt="" width={181} height={50} priority className="theme-dark-only h-[50px] w-auto object-contain" />
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--qlico-muted)]">
            {isResuming
              ? "We've temporarily saved your PDF. Sign in to keep it and unlock analytics."
              : "Sign in to compose, publish, and measure your digital shelf."}
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
          <div className="flex flex-col gap-5">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              className="flex items-center justify-center gap-3 rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)] py-3 font-semibold text-[var(--qlico-ink)] transition hover:bg-[var(--qlico-subtle)]"
            >
              <svg width="18" height="18" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" /><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" /><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" /><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" /></svg>
              Continue with Google
            </button>
            <div className="flex items-center gap-3 text-xs font-semibold text-[var(--qlico-muted)] before:h-px before:flex-1 before:bg-[var(--qlico-border)] after:h-px after:flex-1 after:bg-[var(--qlico-border)]">
              OR
            </div>
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
                className="rounded-full bg-[var(--accent)] py-3.5 font-semibold uppercase tracking-[0.16em] text-[var(--accent-contrast)] shadow-md transition hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] disabled:translate-y-0 disabled:opacity-50"
              >
                {loading ? 'Sending…' : 'Send magic link'}
              </button>
            </form>
          </div>
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
