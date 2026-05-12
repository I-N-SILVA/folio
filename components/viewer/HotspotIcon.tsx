'use client'

import { useState } from 'react'
import * as LucideIcons from 'lucide-react'
import { trackEvent } from '@/lib/tracking'
import type { Hotspot } from '@/lib/book-schema'

interface HotspotIconProps {
  hotspot: Hotspot
  bookId: string
  pageNumber: number
  onClick: (hotspot: Hotspot) => void
}

export function HotspotIcon({ hotspot, bookId, pageNumber, onClick }: HotspotIconProps) {
  const [clicked, setClicked] = useState(false)

  const Icon = (LucideIcons as any)[hotspot.icon] ?? LucideIcons.Info

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

  return (
    <button
      className="absolute pointer-events-auto transform -translate-x-1/2 -translate-y-1/2 group"
      style={{ left: `${hotspot.x}%`, top: `${hotspot.y}%` }}
      onClick={handleClick}
      onTouchStart={handleTouchStart}
      aria-label={hotspot.label}
      title={hotspot.label}
    >
      {/* Pulsing ring — stops after first click */}
      {!clicked && (
        <span className="absolute inline-flex w-full h-full rounded-full bg-white/60 animate-ping" />
      )}
      <span className="relative flex items-center justify-center w-8 h-8 rounded-full bg-white/90 shadow-lg hover:scale-110 transition-transform">
        <Icon size={16} className="text-gray-800" />
      </span>
    </button>
  )
}
