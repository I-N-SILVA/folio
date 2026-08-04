'use client'

import { useEffect, useState, useSyncExternalStore } from 'react'
import { twMerge } from 'tailwind-merge'
import { Layers, SlidersHorizontal } from 'lucide-react'
import { useEditorStore } from '@/lib/editor-store'
import { Modal } from '@/components/ui/Modal'
import { PageListSidebar } from './PageListSidebar'
import { SettingsPanel } from './settings'

type Panel = 'pages' | 'inspector' | null

/** Matches the `lg` breakpoint, where the real side panels take over. */
const DESKTOP_QUERY = '(min-width: 1024px)'

function subscribeToDesktop(onChange: () => void) {
  const mq = window.matchMedia(DESKTOP_QUERY)
  mq.addEventListener('change', onChange)
  return () => mq.removeEventListener('change', onChange)
}

/**
 * Below `lg` the editor's two side panels are hidden, which used to leave
 * small screens with a canvas and nothing else: no way to switch pages, edit
 * a block you just added, or reach edition settings. This docks both panels
 * behind thumb-reachable tabs and surfaces them as bottom sheets.
 */
export function MobileEditorDock() {
  const { book, currentPageIndex, setCurrentPageIndex } = useEditorStore()
  const [panel, setPanel] = useState<Panel>(null)

  // The sheets render through a portal to document.body, so the `lg:hidden`
  // class on the dock bar never applied to them: on desktop, selecting a block
  // popped a bottom sheet over the inspector that was already showing it.
  // Whether this component does anything has to be a real viewport check.
  const isDesktop = useSyncExternalStore(
    subscribeToDesktop,
    () => window.matchMedia(DESKTOP_QUERY).matches,
    () => false
  )

  const pages = book?.pages ?? []
  const total = pages.length

  // Selecting something on the canvas is a request to edit it — on desktop
  // the inspector is always visible, so on mobile the sheet has to come to
  // the user instead of making them hunt for the tab. Driven off the store
  // subscription rather than a render-derived effect so it fires only on an
  // actual selection change, not on every re-render that keeps the same one.
  useEffect(
    () =>
      useEditorStore.subscribe((state, prev) => {
        if (window.matchMedia(DESKTOP_QUERY).matches) return
        const changed =
          state.selectedBlockId !== prev.selectedBlockId ||
          state.selectedHotspotId !== prev.selectedHotspotId
        if (changed && (state.selectedBlockId || state.selectedHotspotId)) {
          setPanel('inspector')
        }
      }),
    []
  )

  // Picking a page from the sheet means the user wants to see it, not keep
  // reading the list.
  const closeOnPick = (index: number) => {
    setCurrentPageIndex(index)
    setPanel(null)
  }

  // Bailing out here covers a mid-session resize too: nothing this component
  // owns renders on desktop, sheets included.
  if (!book || isDesktop) return null

  return (
    <>
      <div className="flex shrink-0 items-center gap-1 border-t border-neutral-800 bg-neutral-900 px-2 py-1.5 lg:hidden">
        <DockTab
          active={panel === 'pages'}
          onClick={() => setPanel(panel === 'pages' ? null : 'pages')}
          icon={<Layers size={15} />}
          label="Pages"
        />

        <div className="flex flex-1 items-center justify-center gap-1">
          <button
            type="button"
            onClick={() => closeOnPick(Math.max(0, currentPageIndex - 1))}
            disabled={currentPageIndex === 0}
            aria-label="Previous page"
            className="grid h-9 w-9 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-30"
          >
            ‹
          </button>
          <span className="min-w-[54px] text-center text-xs font-semibold tabular-nums text-neutral-300">
            {currentPageIndex + 1} / {total}
          </span>
          <button
            type="button"
            onClick={() => closeOnPick(Math.min(total - 1, currentPageIndex + 1))}
            disabled={currentPageIndex >= total - 1}
            aria-label="Next page"
            className="grid h-9 w-9 place-items-center rounded-md text-neutral-400 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-30"
          >
            ›
          </button>
        </div>

        <DockTab
          active={panel === 'inspector'}
          onClick={() => setPanel(panel === 'inspector' ? null : 'inspector')}
          icon={<SlidersHorizontal size={15} />}
          label="Edit"
        />
      </div>

      {panel === 'pages' && (
        <Modal
          onClose={() => setPanel(null)}
          title="Pages"
          variant="sheet"
          className="bg-neutral-900 text-neutral-100"
        >
          <SheetHeader title="Pages" />
          <div className="h-[62vh]">
            <PageListSidebar onPageSelected={() => setPanel(null)} />
          </div>
        </Modal>
      )}

      {panel === 'inspector' && (
        <Modal
          onClose={() => setPanel(null)}
          title="Edit selection"
          variant="sheet"
          className="bg-neutral-900 text-neutral-100"
        >
          <SheetHeader title="Edit" />
          <div className="h-[62vh]">
            <SettingsPanel />
          </div>
        </Modal>
      )}
    </>
  )
}

function DockTab({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean
  onClick: () => void
  icon: React.ReactNode
  label: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-expanded={active}
      className={twMerge(
        // 44px min target — these are the primary controls on touch.
        'flex min-h-[44px] items-center gap-1.5 rounded-lg px-3 text-xs font-semibold transition-colors',
        active
          ? 'bg-[var(--accent-vivid)]/20 text-white'
          : 'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-100'
      )}
    >
      {icon}
      {label}
    </button>
  )
}

function SheetHeader({ title }: { title: string }) {
  return (
    <div className="sticky top-0 z-10 flex items-center gap-2 border-b border-neutral-800 bg-neutral-900 px-4 py-3">
      <span className="absolute left-1/2 top-1.5 h-1 w-10 -translate-x-1/2 rounded-full bg-neutral-700" />
      <span className="text-[11px] font-bold uppercase tracking-widest text-neutral-400">
        {title}
      </span>
    </div>
  )
}
