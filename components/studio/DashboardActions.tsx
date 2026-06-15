'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, UserCircle } from 'lucide-react'
import { CreateFolioModal } from './CreateFolioModal'
import { SignOutButton } from './SignOutButton'

export function DashboardActions() {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
      <div className="flex items-center gap-2">
        <Link
          href="/account"
          className="flex items-center gap-2 rounded-full border border-[var(--folio-border)] bg-white/60 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--folio-ink)] transition hover:-translate-y-0.5 hover:bg-white"
        >
          <UserCircle size={16} />
          Account
        </Link>
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-[0_16px_34px_rgba(0,102,255,0.24)] transition hover:-translate-y-0.5 hover:bg-[var(--accent-hover)]"
        >
          <Plus size={16} />
          Create New
        </button>
        <SignOutButton className="px-4 py-3" />
      </div>

      {createOpen && <CreateFolioModal onClose={() => setCreateOpen(false)} />}
    </>
  )
}
