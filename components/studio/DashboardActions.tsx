'use client'

import Link from 'next/link'
import { Plus, UserCircle } from 'lucide-react'
import { SignOutButton } from './SignOutButton'
import { InstallPrompt } from '@/components/InstallPrompt'

/**
 * Rendered in both the header and the empty state, so it holds no dialog
 * state of its own — the create flow is owned by CreateBookLauncher and
 * opened by navigating to `?new=1`.
 */
export function DashboardActions() {
  return (
    <div className="flex items-center gap-2">
      <InstallPrompt className="hidden sm:flex" />
      <Link
        href="/account"
        className="flex items-center gap-2 rounded-full border border-[var(--qlico-border)] bg-white/60 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--qlico-ink)] transition hover:-translate-y-0.5 hover:bg-white"
      >
        <UserCircle size={16} />
        Account
      </Link>
      <Link
        href="/dashboard?new=1"
        scroll={false}
        className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[0_16px_34px_rgba(60,35,132,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--accent-hover)]"
      >
        <Plus size={16} />
        Create New
      </Link>
      <SignOutButton className="px-4 py-3" />
    </div>
  )
}
