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
          className="flex items-center gap-2 bg-[#01696F] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          Create New
        </button>
      </div>

      {createOpen && <CreateFolioModal onClose={() => setCreateOpen(false)} />}
    </>
  )
}
