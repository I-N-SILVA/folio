import Link from 'next/link'
import { Mark } from './Mark'

export function Footer() {
  return (
    <footer className="border-t border-[var(--qlico-hairline)] px-5 py-12">
      <div className="mx-auto max-w-6xl">
        <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center">
              <Mark className="h-7 w-auto" />
            </div>
            <p className="mt-3 max-w-xs text-sm text-[var(--qlico-muted)]">
              Interactive publishing — with craft, context, and control.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-14 gap-y-2.5 text-sm sm:grid-cols-3">
            <Link href="#features" className="text-[var(--qlico-muted)] transition hover:text-[var(--qlico-ink)]">Features</Link>
            <Link href="#pricing" className="text-[var(--qlico-muted)] transition hover:text-[var(--qlico-ink)]">Pricing</Link>
            <Link href="/book/demo" className="text-[var(--qlico-muted)] transition hover:text-[var(--qlico-ink)]">Demo</Link>
            <Link href="/press" className="text-[var(--qlico-muted)] transition hover:text-[var(--qlico-ink)]">Press</Link>
            <Link href="/privacy" className="text-[var(--qlico-muted)] transition hover:text-[var(--qlico-ink)]">Privacy</Link>
            <Link href="/terms" className="text-[var(--qlico-muted)] transition hover:text-[var(--qlico-ink)]">Terms</Link>
          </div>
        </div>
        <div className="mt-10 border-t border-[var(--qlico-hairline)] pt-6 text-sm text-[var(--qlico-muted)]">
          © {new Date().getFullYear()} QLICO. All rights reserved.
        </div>
      </div>
    </footer>
  )
}
