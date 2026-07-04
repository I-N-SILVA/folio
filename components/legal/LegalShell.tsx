import Link from 'next/link'
import type { ReactNode } from 'react'

export function LegalShell({
  title,
  updated,
  children,
}: {
  title: string
  updated: string
  children: ReactNode
}) {
  return (
    <main className="qlico-grain min-h-screen bg-[var(--background)] px-5 py-16 text-[var(--qlico-ink)] sm:px-8">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm font-bold text-[var(--qlico-muted)] hover:text-[var(--qlico-ink)]">
          ← Back to QLICO
        </Link>
        <h1 className="mt-6 font-display text-5xl font-semibold tracking-[-0.06em] sm:text-6xl">{title}</h1>
        <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--qlico-muted)]">
          Last updated {updated}
        </p>
        <div className="qlico-legal mt-10 space-y-8">{children}</div>
      </div>
    </main>
  )
}

export function LegalSection({ heading, children }: { heading: string; children: ReactNode }) {
  return (
    <section>
      <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">{heading}</h2>
      <div className="mt-3 space-y-3 text-[15px] leading-7 text-[var(--qlico-muted)]">{children}</div>
    </section>
  )
}
