'use client'

import { useEffect, useState } from 'react'
import type { DataBlock as DataBlockType } from '@/lib/book-schema'

/**
 * Spreads the first poll of many blocks across a few hundred milliseconds.
 * Derived from the block rather than random so it stays stable across renders
 * and doesn't make the component impure.
 *
 * FNV-1a, because the obvious `h * 31 + c` accumulator maps near-identical
 * strings to near-identical values — and these seeds are near-identical by
 * nature, being URLs that differ in one query parameter. Measured: six blocks
 * still fired within 1ms of each other. This mixes.
 */
function hashJitter(seed: string): number {
  let h = 2166136261
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 1000) / 1000
}

/** An abort caused by our own deadline is a real failure; unmount isn't. */
const timedOutControllers = new WeakSet<AbortController>()
function timedOut(c: AbortController): boolean {
  return timedOutControllers.has(c)
}

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

// How often a published edition re-polls its data source. Short enough that
// "Live" isn't a lie, long enough not to hammer the source.
const REFRESH_MS = 45_000

/** A hanging source used to leave the badge on "loading" indefinitely. */
const FETCH_TIMEOUT_MS = 8_000

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
    let inFlight: AbortController | null = null

    function load() {
      // The reader mounts every page of the edition at once, so a book with a
      // live figure on twenty pages has twenty of these running. Skipping a
      // poll while the tab is in the background stops that becoming a standing
      // load on the author's data source for as long as a tab stays open.
      if (typeof document !== 'undefined' && document.visibilityState === 'hidden') return

      // Supersede any request still outstanding, and give it a deadline: a
      // source that never responds used to leave the badge on "loading"
      // forever, with no error and no retry.
      inFlight?.abort()
      const controller = new AbortController()
      inFlight = controller
      const timeout = setTimeout(() => {
        timedOutControllers.add(controller)
        controller.abort()
      }, FETCH_TIMEOUT_MS)

      fetch(block.source, { cache: 'no-store', signal: controller.signal })
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
          if (!active) return
          // Aborts come from three places: unmount, a newer poll superseding
          // this one, and our own deadline. Only the deadline is a failure the
          // reader should see.
          if (controller.signal.aborted && !timedOut(controller)) return
          setStatus('error')
        })
        .finally(() => {
          clearTimeout(timeout)
          if (inFlight === controller) inFlight = null
        })
    }

    // Debounced so live-editing the source/path in the studio doesn't spam
    // fetches, and staggered so twenty blocks don't all fire in the same tick.
    const initial = setTimeout(load, 350 + Math.floor(hashJitter(block.id + block.source) * 600))
    const interval = setInterval(load, REFRESH_MS)
    function onVisible() {
      if (document.visibilityState === 'visible') load()
    }
    document.addEventListener('visibilitychange', onVisible)

    return () => {
      active = false
      inFlight?.abort()
      clearTimeout(initial)
      clearInterval(interval)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [block.source, block.path, block.id])

  const display = value ?? block.fallback ?? '—'
  const align =
    block.align === 'center' ? 'justify-center' : block.align === 'right' ? 'justify-end' : 'justify-start'

  const live = status === 'live'
  // The badge read "Live" while the first request was still in flight, which
  // claimed a fresh value before one existed.
  const badgeLabel =
    status === 'error' ? (value ? 'Stale' : 'Offline') : status === 'loading' ? 'Checking' : 'Live'
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
