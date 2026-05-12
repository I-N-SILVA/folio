'use client'

import { useState } from 'react'
import { HotspotIcon } from './HotspotIcon'
import { HotspotModal } from './HotspotModal'
import type { Hotspot } from '@/lib/book-schema'

interface HotspotLayerProps {
  hotspots: Hotspot[]
  bookId: string
  pageNumber: number
  onModalOpenChange: (open: boolean) => void
}

export function HotspotLayer({ hotspots, bookId, pageNumber, onModalOpenChange }: HotspotLayerProps) {
  const [activeHotspot, setActiveHotspot] = useState<Hotspot | null>(null)

  if (hotspots.length === 0) return null

  function openHotspot(hotspot: Hotspot) {
    setActiveHotspot(hotspot)
    onModalOpenChange(true)
  }

  function closeHotspot() {
    setActiveHotspot(null)
    onModalOpenChange(false)
  }

  return (
    <>
      {/* pointer-events: none on the layer, auto on each icon */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="false">
        {hotspots.map((hotspot) => (
          <HotspotIcon
            key={hotspot.id}
            hotspot={hotspot}
            bookId={bookId}
            pageNumber={pageNumber}
            onClick={openHotspot}
          />
        ))}
      </div>

      {activeHotspot && (
        <HotspotModal
          hotspot={activeHotspot}
          bookId={bookId}
          pageNumber={pageNumber}
          onClose={closeHotspot}
        />
      )}
    </>
  )
}
