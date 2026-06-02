'use client'

import { useState } from 'react'
import { Plus } from 'lucide-react'
import { CreateFolioModal } from './CreateFolioModal'

export function DashboardActions() {
  const [createOpen, setCreateOpen] = useState(false)

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setCreateOpen(true)}
          className="flex items-center gap-2 rounded-full bg-[var(--folio-teal)] px-5 py-3 text-sm font-extrabold uppercase tracking-[0.14em] text-white shadow-[0_16px_34px_rgba(13,102,97,0.22)] transition hover:-translate-y-0.5 hover:bg-[#09514d]"
        >
          <Plus size={16} />
          Create New
        </button>
      </div>

      {createOpen && <CreateFolioModal onClose={() => setCreateOpen(false)} />}
    </>
  )
}
