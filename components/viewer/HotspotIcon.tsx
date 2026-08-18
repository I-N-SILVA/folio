'use client'

import { createElement, useState } from 'react'
import { trackEvent } from '@/lib/tracking'
import { hotspotIcon } from '@/lib/hotspot-icons'
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

  return (
    <button
      className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 group"
      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      aria-label={hotspot.label}
      title={hotspot.label}
    >
      {/* Pulsing ring — stops after first click, unless it's a high-value action */}
      {(!clicked || isEcomAction) && (
        <span
          aria-hidden="true"
          className="absolute inline-flex h-full w-full animate-ping rounded-full bg-white/60"
          // A slower pulse for a hotspot that leads somewhere, so it reads as an
          // invitation rather than an alarm. (The global reduced-motion reset in
          // globals.css stops the animation after one iteration either way.)
          style={isEcomAction ? { animationDuration: '2s' } : undefined}
        />
      )}
      <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/90 shadow-lg hover:scale-110 transition-transform">
        {/* `createElement` rather than a `<Icon />` variable: the icon is chosen
            at runtime from the shared map, and assigning a component inside
            render is what the react-compiler lint rule (rightly) objects to. */}
        {createElement(hotspotIcon(hotspot.icon), {
          size: 16,
          className: isEcomAction ? 'text-[var(--accent)]' : 'text-gray-800',
        })}
      </span>
      {hotspot.action === 'checkout' && hotspot.price && (
        <span className="absolute left-1/2 top-full mt-1.5 -translate-x-1/2 whitespace-nowrap rounded-full bg-[var(--accent)] px-2 py-0.5 text-[10px] font-bold text-white shadow-md">
          {hotspot.price}
        </span>
      )}
    </button>
  )
}
