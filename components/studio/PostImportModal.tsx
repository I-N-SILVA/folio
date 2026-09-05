'use client'

import { useEffect, useRef, useState } from 'react'
import { Loader2, ShoppingBag, Link2, Sparkle, Crosshair } from 'lucide-react'
import { toast } from 'sonner'
import { Modal } from '@/components/ui/Modal'
import { useEditorStore } from '@/lib/editor-store'
import { trackProduct } from '@/lib/product-analytics'
import type { Hotspot } from '@/lib/book-schema'

/**
 * The moment after an import lands.
 *
 * Import used to push straight to the editor, where the author was looking at
 * pictures of their own PDF with nothing changed and no next step. The action
 * that makes it not-a-PDF was a toolbar toggle among nine others, and the better
 * one — auto-detect — ran on the current page only, so on a 24-page import it
 * was an offer you had to accept 24 times.
 *
 * This asks once, across every page, and writes nothing until the author says
 * so. Accepting is a single undoable step, which is the only reason it is safe
 * to offer "add all" at all.
 */

interface Found {
  pageId: string
  pageNumber: number
  hotspots: Hotspot[]
}

type Phase = 'scanning' | 'found' | 'nothing' | 'failed'

function summarise(found: Found[]) {
  const all = found.flatMap((f) => f.hotspots)
  return {
    total: all.length,
    products: all.filter((h) => h.action === 'checkout').length,
    links: all.filter((h) => h.action === 'link').length,
    notes: all.filter((h) => h.action === 'modal').length,
    pages: found.filter((f) => f.hotspots.length > 0).length,
  }
}

export function PostImportModal({ onClose }: { onClose: () => void }) {
  const book = useEditorStore((s) => s.book)
  const addHotspotsBatch = useEditorStore((s) => s.addHotspotsBatch)
  const [phase, setPhase] = useState<Phase>('scanning')
  const [found, setFound] = useState<Found[]>([])
  const started = useRef(false)

  const pageCount = book?.pages?.length ?? 0

  useEffect(() => {
    if (started.current || !book?.pages?.length) return
    started.current = true

    const controller = new AbortController()

    fetch('/api/ai/detect-hotspots', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pages: book.pages }),
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : Promise.reject(new Error('detect failed'))))
      .then((data: { byPage?: Found[] }) => {
        const hits = (data.byPage ?? []).filter((p) => p.hotspots.length > 0)
        setFound(hits)
        setPhase(hits.length ? 'found' : 'nothing')
      })
      .catch((err) => {
        if (err?.name === 'AbortError') return
        // Failing soft matters here: this runs on top of a successful import, and
        // a detection that errors must not read as "your import broke".
        setPhase('failed')
      })

    return () => controller.abort()
  }, [book])

  const stats = summarise(found)

  function acceptAll() {
    addHotspotsBatch(found.map((f) => ({ pageId: f.pageId, hotspots: f.hotspots })))
    trackProduct('edition_enriched', { kind: 'hotspot', count: stats.total, source: 'post_import' })
    toast.success(
      `${stats.total} pin${stats.total === 1 ? '' : 's'} added across ${stats.pages} page${stats.pages === 1 ? '' : 's'} — ⌘Z undoes all of it`
    )
    onClose()
  }

  return (
    <Modal
      onClose={onClose}
      title="Import complete"
      className="w-[540px] max-w-[calc(100vw-2rem)] overflow-hidden border border-neutral-700 bg-neutral-900 p-0"
    >
      <div className="p-6">
        <p className="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500">
          {pageCount} page{pageCount === 1 ? '' : 's'} imported
        </p>

        {phase === 'scanning' && (
          <>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] text-neutral-100">
              Reading your pages…
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Looking for products with prices, links in your copy, and anything worth turning into
              something a reader can tap. Nothing is added until you say so.
            </p>
            <div className="mt-6 flex items-center gap-2.5 text-sm text-neutral-400">
              <Loader2 size={16} className="animate-spin text-[var(--studio-select)]" />
              Scanning
            </div>
          </>
        )}

        {phase === 'found' && (
          <>
            <h2 className="mt-2 font-display text-2xl font-semibold leading-tight tracking-[-0.02em] text-neutral-100">
              Your pages are in.
              <br />
              Here is what QLICO found.
            </h2>

            <ul className="mt-5 flex flex-col gap-1.5">
              {stats.products > 0 && (
                <FoundRow
                  count={stats.products}
                  icon={<ShoppingBag size={15} />}
                  title={`Product${stats.products === 1 ? '' : 's'} with a price`}
                  detail="Each becomes a pin a reader can tap to buy"
                />
              )}
              {stats.links > 0 && (
                <FoundRow
                  count={stats.links}
                  icon={<Link2 size={15} />}
                  title={`Link${stats.links === 1 ? '' : 's'} in your copy`}
                  detail="Turned into pins that report which ones get clicked"
                />
              )}
              {stats.notes > 0 && (
                <FoundRow
                  count={stats.notes}
                  icon={<Sparkle size={15} />}
                  title={`Detail${stats.notes === 1 ? '' : 's'} worth expanding`}
                  detail="A pin that opens a note without leaving the page"
                />
              )}
            </ul>

            <p className="mt-4 text-[12.5px] leading-5 text-neutral-500">
              Across {stats.pages} of your {pageCount} pages. Adding them is one step — a single ⌘Z
              takes all of it back.
            </p>
          </>
        )}

        {phase === 'nothing' && (
          <>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] text-neutral-100">
              Your pages are in.
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              Nothing obvious to make interactive — no prices or links in the text. You can place
              pins yourself wherever they belong: hit <Kbd>Add hotspot</Kbd> and click the page.
            </p>
          </>
        )}

        {phase === 'failed' && (
          <>
            <h2 className="mt-2 font-display text-2xl font-semibold tracking-[-0.02em] text-neutral-100">
              Your pages are in.
            </h2>
            <p className="mt-3 text-sm leading-6 text-neutral-400">
              The scan for products and links didn&apos;t finish, which doesn&apos;t affect your
              import — every page is here. Try <Kbd>Auto-detect pins</Kbd> in the toolbar, or place
              them yourself.
            </p>
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-neutral-800 bg-neutral-900/60 px-6 py-4">
        {phase === 'found' ? (
          <>
            <button
              type="button"
              onClick={acceptAll}
              className="flex items-center gap-2 rounded-full bg-white px-5 py-2.5 text-xs font-bold text-black transition-transform hover:scale-[1.02]"
            >
              <Crosshair size={14} />
              Add all {stats.total}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-neutral-700 px-4 py-2.5 text-xs font-semibold text-neutral-300 transition-colors hover:bg-neutral-800"
            >
              Not now
            </button>
            <span className="ml-auto text-[11px] text-neutral-500">
              You can always add them later
            </span>
          </>
        ) : (
          <button
            type="button"
            onClick={onClose}
            disabled={phase === 'scanning'}
            className="rounded-full bg-white px-5 py-2.5 text-xs font-bold text-black transition-transform hover:scale-[1.02] disabled:opacity-40"
          >
            {phase === 'scanning' ? 'Scanning…' : 'Start editing'}
          </button>
        )}
      </div>
    </Modal>
  )
}

function FoundRow({
  count,
  icon,
  title,
  detail,
}: {
  count: number
  icon: React.ReactNode
  title: string
  detail: string
}) {
  return (
    <li className="flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-800/40 px-3.5 py-2.5">
      <span className="min-w-[26px] font-display text-xl font-semibold tabular-nums text-neutral-100">
        {count}
      </span>
      <span className="text-neutral-500">{icon}</span>
      <span className="min-w-0">
        <span className="block text-[13px] font-medium text-neutral-100">{title}</span>
        <span className="block text-[11.5px] text-neutral-500">{detail}</span>
      </span>
    </li>
  )
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <span className="rounded bg-neutral-800 px-1.5 py-0.5 text-[11px] font-semibold text-neutral-300">
      {children}
    </span>
  )
}
