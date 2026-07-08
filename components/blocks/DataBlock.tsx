'use client'

import { useEffect, useState } from 'react'
import type { DataBlock as DataBlockType } from '@/lib/book-schema'

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

// How often a published edition re-polls its data source. Short enough that
// "Live" isn't a lie, long enough not to hammer the source.
const REFRESH_MS = 45_000

type Status = 'loading' | 'live' | 'stale' | 'error'

/**
 * Living editions — binds to a JSON source and renders the current value with a
 * "Live" pulse. Change the source and the published edition updates itself.
 * Re-polls on an interval and whenever the tab regains focus, so a reader who
 * keeps the page open actually sees updates land.
 */
export function DataBlock({ block }: { block: DataBlockType }) {
  const [value, setValue] = useState<string | null>(null)
  const [status, setStatus] = useState<Status>('loading')

  useEffect(() => {
    let active = true

    function load() {
      fetch(block.source, { cache: 'no-store' })
        .then((r) => {
          if (!r.ok) throw new Error(`${r.status}`)
          return r.json()
        })
        .then((json) => {
          if (!active) return
          const v = getPath(json, block.path)
          if (v != null) {
            setValue(String(v))
            setStatus('live')
          } else {
            setStatus('error')
          }
        })
        .catch(() => {
          if (active) setStatus('error')
        })
    }

    // Debounced so live-editing the source/path in the studio doesn't spam fetches.
    const initial = setTimeout(load, 350)
    const interval = setInterval(load, REFRESH_MS)
    function onVisible() {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      active = false
      clearTimeout(initial)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [block.source, block.path])

  const display = value ?? block.fallback ?? '—'
  const align =
    block.align === 'center' ? 'justify-center' : block.align === 'right' ? 'justify-end' : 'justify-start'

  const live = status === 'live'
  const badgeLabel = status === 'error' ? (value ? 'Stale' : 'Offline') : 'Live'
  const badgeColor = status === 'error' ? '#b45309' : 'var(--primary)'

  return (
    <div className={`flex items-center gap-3 ${align}`} style={{ fontFamily: 'var(--body-font)' }}>
      <div className={block.align === 'center' ? 'text-center' : ''}>
        <div className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-60">{block.label}</div>
        <div className="text-3xl font-semibold leading-tight" style={{ fontFamily: 'var(--heading-font)' }}>
          {block.prefix}
          {display}
          {block.suffix}
        </div>
      </div>
      <span
        title={status === 'error' ? 'Could not reach the data source' : undefined}
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
        style={{
          color: live ? badgeColor : status === 'error' ? badgeColor : 'var(--muted-color, currentColor)',
          borderColor: live
            ? 'color-mix(in srgb, var(--primary) 35%, transparent)'
            : status === 'error'
              ? 'color-mix(in srgb, #b45309 35%, transparent)'
              : 'currentColor',
          opacity: status === 'loading' ? 0.5 : 1,
        }}
      >
        <span className="relative flex h-1.5 w-1.5">
          {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-75" />}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full" style={{ background: badgeColor }} />
        </span>
        {badgeLabel}
      </span>
    </div>
  )
}
