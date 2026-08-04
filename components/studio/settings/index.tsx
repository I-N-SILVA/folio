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
      {/* Segmented control rather than two underlined tabs: at this width the
          underline reads as a stray rule, and the pill makes the active pane
          obvious at a glance. */}
      <div className="shrink-0 border-b border-neutral-800 p-2">
        <div className="flex gap-1 rounded-lg bg-neutral-950/60 p-1">
          {(['selection', 'book'] as const).map((key) => (
            <button
              key={key}
              onClick={() => setTab(key)}
              aria-pressed={tab === key}
              className={twMerge(
                'flex-1 rounded-md py-1.5 text-[11px] font-semibold tracking-wide transition-colors',
                tab === key
                  ? 'bg-[var(--accent-vivid)]/15 text-white ring-1 ring-inset ring-[var(--accent-vivid)]/30'
                  : 'text-neutral-500 hover:text-neutral-300'
              )}
            >
              {key === 'selection' ? 'Selection' : 'Edition'}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-3 custom-scrollbar">
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
