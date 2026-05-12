'use client'

import { useState } from 'react'
import Link from 'next/link'
import { Plus, FileUp } from 'lucide-react'
import { ImportPDFModal } from './ImportPDFModal'

export function DashboardActions() {
  const [importOpen, setImportOpen] = useState(false)

  return (
    <>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setImportOpen(true)}
          className="flex items-center gap-2 border border-gray-200 bg-white text-gray-700 px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
        >
          <FileUp size={16} />
          Import PDF
        </button>

        <Link
          href="/create"
          className="flex items-center gap-2 bg-[#01696F] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
        >
          <Plus size={16} />
          New Book
        </Link>
      </div>

      {importOpen && <ImportPDFModal onClose={() => setImportOpen(false)} />}
    </>
  )
}
