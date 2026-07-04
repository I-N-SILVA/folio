import Link from 'next/link'

export default function NotFound() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-8 text-[var(--qlico-ink)]">
      <div className="max-w-md text-center">
        <p className="text-sm font-semibold text-[var(--accent)]">404</p>
        <h1 className="mt-3 text-4xl font-semibold tracking-[-0.03em]">Page not found</h1>
        <p className="mx-auto mt-3 max-w-xs text-[15px] leading-7 text-[var(--qlico-muted)]">
          This edition doesn't exist or has been removed.
        </p>
        <Link
          href="/dashboard"
          className="mt-7 inline-block rounded-full bg-[var(--accent)] px-6 py-3 text-[15px] font-semibold text-white transition hover:bg-[var(--accent-hover)]"
        >
          Go to dashboard
        </Link>
      </div>
    </main>
  )
}
