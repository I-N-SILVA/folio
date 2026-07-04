'use client'

import { useEffect } from 'react'
import Link from 'next/link'

export default function Error({ error, reset }: { error: Error; reset: () => void }) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-8 text-[var(--qlico-ink)]">
      <div className="max-w-md text-center">
        <h1 className="text-4xl font-semibold tracking-[-0.03em]">Something went wrong</h1>
        <p className="mx-auto mt-3 max-w-sm text-[15px] leading-7 text-[var(--qlico-muted)]">
          {error.message || 'An unexpected error occurred.'}
        </p>
        <div className="mt-7 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-[var(--accent)] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[var(--accent-hover)]"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-full border border-[var(--qlico-border)] px-6 py-3 text-[15px] font-semibold text-[var(--qlico-ink)] transition hover:bg-black/5"
          >
            Go to dashboard
          </Link>
        </div>
      </div>
    </main>
  )
}
