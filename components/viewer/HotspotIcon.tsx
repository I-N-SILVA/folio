'use client'

import { createElement, useState } from 'react'
import { trackEvent } from '@/lib/tracking'
import { hotspotIcon } from '@/lib/hotspot-icons'
import { ShoppingBag, Volume2 } from 'lucide-react'
import type { Hotspot } from '@/lib/book-schema'

interface HotspotIconProps {
  hotspot: Hotspot
  bookId: string
  pageNumber: number
  onClick: (hotspot: Hotspot) => void
}

export function HotspotIcon({ hotspot, bookId, pageNumber, onClick }: HotspotIconProps) {
  const [clicked, setClicked] = useState(false)

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation()
    e.preventDefault()
    setClicked(true)
    trackEvent(bookId, 'hotspot_click', {
      hotspot_id: hotspot.id,
      page_number: pageNumber,
    })
    onClick(hotspot)
  }

  function handleTouchStart(e: React.TouchEvent) {
    e.stopPropagation()
  }

  const isEcomAction = hotspot.action === 'checkout' || hotspot.action === 'link'
  const style = hotspot.beaconStyle ?? (isEcomAction ? 'shopping' : 'pulse')

  // 1. Shopping Pill Style
  if (style === 'shopping') {
    return (
      <button
        className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 group z-30 transition-all hover:scale-105"
        style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        aria-label={hotspot.label}
      >
        <span className="flex items-center gap-1.5 rounded-full bg-black/90 px-3 py-1 text-white shadow-2xl border border-white/20 backdrop-blur-md transition-all group-hover:bg-black group-hover:border-white/40">
          <ShoppingBag size={12} className="text-amber-300" />
          <span className="text-[11px] font-bold tracking-tight">
            {hotspot.price ? hotspot.price : hotspot.label}
          </span>
        </span>
      </button>
    )
  }

  // 2. Audio Soundwave Beacon
  if (style === 'audio') {
    return (
      <button
        className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 group z-30 transition-all hover:scale-110"
        style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        aria-label={hotspot.label}
      >
        <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-neutral-900/90 text-white border border-neutral-700 shadow-xl backdrop-blur-md">
          <Volume2 size={14} className="text-cyan-400" />
          <span className="absolute -top-0.5 -right-0.5 flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-500" />
          </span>
        </span>
      </button>
    )
  }

  // 3. Numbered Step Marker
  if (style === 'step') {
    return (
      <button
        className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 group z-30 transition-all hover:scale-110"
        style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        aria-label={hotspot.label}
      >
        <span className="flex h-7 w-7 items-center justify-center rounded-full bg-white text-black font-mono text-xs font-black shadow-2xl border-2 border-black group-hover:bg-black group-hover:text-white group-hover:border-white transition-colors">
          {hotspot.stepNumber ?? '1'}
        </span>
      </button>
    )
  }

  // 4. Minimalist Dot
  if (style === 'minimal') {
    return (
      <button
        className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 group z-30 p-2"
        style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
        onClick={handleClick}
        onTouchStart={handleTouchStart}
        aria-label={hotspot.label}
      >
        <span className="block h-3.5 w-3.5 rounded-full bg-white/90 shadow-lg ring-2 ring-black/40 group-hover:scale-150 transition-transform" />
      </button>
    )
  }

  // 5. Radar Pulse Dot (Default)
  return (
    <button
      className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 group z-30"
      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      aria-label={hotspot.label}
      title={hotspot.label}
    >
      {(!clicked || isEcomAction) && (
        <span
          aria-hidden="true"
          className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60"
          style={isEcomAction ? { animationDuration: '2s' } : undefined}
        />
      )}
      <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/95 text-neutral-900 shadow-xl border border-black/10 hover:scale-110 transition-transform">
        {createElement(hotspotIcon(hotspot.icon), {
          size: 15,
          className: isEcomAction ? 'text-amber-600' : 'text-neutral-900',
        })}
      </span>
      {hotspot.action === 'checkout' && hotspot.price && (
        <span className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-neutral-900 px-2 py-0.5 text-[10px] font-bold text-white shadow-md border border-neutral-700">
          {hotspot.price}
        </span>
      )}
    </button>
  )
}
