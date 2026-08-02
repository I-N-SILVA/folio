'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { InstallPrompt } from '@/components/InstallPrompt'

/**
 * Just the primary action now — account and sign-out moved into StudioNav,
 * where they're reachable from every studio surface rather than only here.
 * Rendered in both the page header and the empty state, so it holds no dialog
 * state of its own: the create flow is owned by CreateBookLauncher and opened
 * by navigating to `?new=1`.
 */
export function DashboardActions() {
  return (
    <div className="flex items-center gap-2">
      <InstallPrompt className="hidden sm:flex" />
      <Link
        href="/dashboard?new=1"
        scroll={false}
        className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[0_16px_34px_rgba(60,35,132,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--accent-hover)]"
      >
        <Plus size={16} />
        Create New
      </Link>
    </div>
  )
}
