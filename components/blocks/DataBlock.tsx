'use client'

import { useEffect, useState } from 'react'
import type { DataBlock as DataBlockType } from '@/lib/book-schema'

function getPath(obj: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key]
    return undefined
  }, obj)
}

/**
 * Living editions — binds to a JSON source and renders the current value with a
 * "Live" pulse. Change the source and the published edition updates itself.
 */
export function DataBlock({ block }: { block: DataBlockType }) {
  const [value, setValue] = useState<string | null>(null)
  const [live, setLive] = useState(false)

  useEffect(() => {
    let active = true
    // Debounced so live-editing the source/path in the studio doesn't spam fetches.
    const t = setTimeout(() => {
      fetch(block.source, { cache: 'no-store' })
        .then((r) => r.json())
        .then((json) => {
          if (!active) return
          const v = getPath(json, block.path)
          if (v != null) {
            setValue(String(v))
            setLive(true)
          }
        })
        .catch(() => {})
    }, 350)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [block.source, block.path])

  const display = value ?? block.fallback ?? '—'
  const align =
    block.align === 'center' ? 'justify-center' : block.align === 'right' ? 'justify-end' : 'justify-start'

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
        className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold"
        style={{
          color: live ? 'var(--primary)' : 'var(--muted-color, currentColor)',
          borderColor: live ? 'color-mix(in srgb, var(--primary) 35%, transparent)' : 'currentColor',
          opacity: live ? 1 : 0.5,
        }}
      >
        <span className="relative flex h-1.5 w-1.5">
          {live && <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-[var(--primary)] opacity-75" />}
          <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-[var(--primary)]" />
        </span>
        Live
      </span>
    </div>
  )
}
