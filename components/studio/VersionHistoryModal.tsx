'use client'

import { useCallback, useEffect, useState } from 'react'
import { History, RotateCcw, Bookmark, Loader2 } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { Modal } from '@/components/ui/Modal'
import { relativeTime } from '@/lib/versions'

type Version = {
  id: string
  created_at: string
  label: string | null
  pageCount: number
}

/**
 * What this edition looked like earlier.
 *
 * Undo is a session — `lib/editor-store.ts` keeps a capped in-memory stack and
 * closing the tab is the end of it. The stand-in until now was "duplicate the
 * edition", which spends a slot against the plan's quota and leaves a second
 * thing in the library to be confused by.
 *
 * Restoring is itself a destructive edit, so the server takes a labelled
 * snapshot of the current state before it puts an older one back. That is said
 * out loud here rather than left as a pleasant surprise, because the reason
 * people hesitate over a restore button is not knowing whether it is a one-way
 * door.
 */
export function VersionHistoryModal({
  bookId,
  onClose,
  onRestored,
}: {
  bookId: string
  onClose: () => void
  onRestored: () => void
}) {
  const [versions, setVersions] = useState<Version[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [keeps, setKeeps] = useState(20)
  const [busy, setBusy] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Nothing is set before the first await: a synchronous setState in an effect
  // body cascades a render, which is what `react-hooks/set-state-in-effect`
  // objects to. The clear-on-retry happens with the result, not ahead of it.
  // Nothing is set before the first await, and nothing is set at all once the
  // caller says it has stopped caring.
  const load = useCallback(
    async (live: () => boolean = () => true) => {
      try {
        const res = await fetch(`/api/books/${bookId}/versions`)
        if (!res.ok) throw new Error('Could not load this edition’s history.')
        const data = await res.json()
        if (!live()) return
        setError(null)
        setVersions(data.versions ?? [])
        setUnavailable(Boolean(data.unavailable))
        if (data.keeps) setKeeps(data.keeps)
      } catch (err) {
        if (!live()) return
        setError(err instanceof Error ? err.message : 'Could not load history.')
        setVersions([])
      }
    },
    [bookId]
  )

  useEffect(() => {
    // The flag is not lint appeasement: this fetch outlives a close, and
    // without it a slow response sets state on a modal that is gone.
    let live = true
    void load(() => live)
    return () => {
      live = false
    }
  }, [load])

  async function saveNow() {
    setBusy('new')
    setError(null)
    try {
      const res = await fetch(`/api/books/${bookId}/versions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ label: `Saved ${new Date().toLocaleString()}` }),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not save a version.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save a version.')
    } finally {
      setBusy(null)
    }
  }

  async function restore(version: Version) {
    setBusy(version.id)
    setError(null)
    try {
      const res = await fetch(`/api/books/${bookId}/versions/${version.id}/restore`, {
        method: 'POST',
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not restore that version.')
      // The editor holds the old pages in memory; reloading is the honest way
      // to show what the database now says, and avoids the next autosave
      // writing the pre-restore state straight back over it.
      onRestored()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not restore that version.')
      setBusy(null)
    }
  }

  return (
    <Modal onClose={onClose} title="Version history">
      <div className="flex items-start justify-between gap-4">
        <p className="text-sm leading-6 text-neutral-400">
          A point is kept automatically as you work, and whenever you publish. The last {keeps} are
          held. Restoring saves where you are first, so it is never a one-way door.
        </p>
        <button
          onClick={saveNow}
          disabled={busy !== null || unavailable}
          className="shrink-0 flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-50"
        >
          {busy === 'new' ? <Loader2 size={13} className="animate-spin" /> : <Bookmark size={13} />}
          Save a version
        </button>
      </div>

      {error && (
        <p className="mt-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}

      {unavailable && (
        <p className="mt-4 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-neutral-400">
          Version history is not available on this deployment yet — it needs migration 018.
        </p>
      )}

      <div className="mt-5 max-h-[52vh] space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
        {versions === null && (
          <p className="py-10 text-center text-xs text-neutral-400">Reading the history…</p>
        )}

        {versions?.length === 0 && !unavailable && (
          <p className="py-10 text-center text-xs text-neutral-400">
            Nothing yet. The first point is taken the next time this edition saves.
          </p>
        )}

        {versions?.map((v, i) => (
          <div
            key={v.id}
            className={twMerge(
              'flex items-center gap-3 rounded-xl border border-neutral-800 bg-neutral-900/70 px-3 py-2.5',
              busy === v.id && 'opacity-60'
            )}
          >
            <History size={14} className="shrink-0 text-neutral-400" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-neutral-100">
                {v.label ?? 'While you were working'}
                {i === 0 && (
                  <span className="ml-2 rounded-full bg-neutral-800 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-neutral-300">
                    Latest
                  </span>
                )}
              </p>
              <p className="mt-0.5 text-[11px] text-neutral-400">
                {relativeTime(v.created_at)} · {v.pageCount} page{v.pageCount === 1 ? '' : 's'}
              </p>
            </div>
            <button
              onClick={() => restore(v)}
              disabled={busy !== null}
              className="shrink-0 flex items-center gap-1.5 rounded-lg border border-neutral-700 px-2.5 py-1.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-800 disabled:opacity-50"
            >
              {busy === v.id ? (
                <Loader2 size={12} className="animate-spin" />
              ) : (
                <RotateCcw size={12} />
              )}
              Restore
            </button>
          </div>
        ))}
      </div>
    </Modal>
  )
}
