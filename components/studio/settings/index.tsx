'use client'

import { useEffect, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import { useEditorStore } from '@/lib/editor-store'
import { BlockSettingsForm } from './BlockSettingsForm'
import { PageSettingsForm } from './PageSettingsForm'
import { HotspotSettingsForm } from './HotspotSettingsForm'
import { BookSettingsForm } from './BookSettingsForm'

export function SettingsPanel() {
  const { book, currentPageIndex, selectedBlockId, selectedHotspotId } = useEditorStore()
  const [tab, setTab] = useState<'selection' | 'book'>('selection')

  // Auto-switch to selection tab when something is selected
  useEffect(() => {
    if (selectedBlockId || selectedHotspotId) {
      setTab('selection')
    }
  }, [selectedBlockId, selectedHotspotId])

  const currentPage = book?.pages?.[currentPageIndex]

  if (!book || !currentPage) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm p-4">
        No page loaded
      </div>
    )
  }

  const selectedBlock = selectedBlockId
    ? currentPage.blocks.find((b) => b.id === selectedBlockId)
    : null

  const selectedHotspot = selectedHotspotId
    ? currentPage.hotspots.find((h) => h.id === selectedHotspotId)
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center border-b border-neutral-800 shrink-0">
        <button
          onClick={() => setTab('selection')}
          className={twMerge(
            'flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors',
            tab === 'selection' ? 'text-white border-b-2 border-[var(--accent-vivid)] bg-neutral-800/50' : 'text-neutral-500 hover:text-neutral-300'
          )}
        >
          Selection
        </button>
        <button
          onClick={() => setTab('book')}
          className={twMerge(
            'flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors',
            tab === 'book' ? 'text-white border-b-2 border-[var(--accent-vivid)] bg-neutral-800/50' : 'text-neutral-500 hover:text-neutral-300'
          )}
        >
          Edition
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'book' ? (
          <BookSettingsForm key={book.id} book={book} />
        ) : selectedBlock ? (
          <BlockSettingsForm key={selectedBlock.id} block={selectedBlock} pageId={currentPage.id} />
        ) : selectedHotspot ? (
          <HotspotSettingsForm key={selectedHotspot.id} hotspot={selectedHotspot} pageId={currentPage.id} />
        ) : (
          <PageSettingsForm key={currentPage.id} page={currentPage} />
        )}
      </div>
    </div>
  )
}
