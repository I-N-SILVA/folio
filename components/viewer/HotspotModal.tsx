'use client'

import { useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { X } from 'lucide-react'
import Image from 'next/image'
import { trackEvent } from '@/lib/tracking'
import type { Hotspot } from '@/lib/book-schema'

interface HotspotModalProps {
  hotspot: Hotspot
  bookId: string
  pageNumber: number
  onClose: () => void
}

export function HotspotModal({ hotspot, bookId, pageNumber, onClose }: HotspotModalProps) {
  const openedAt = useRef(Date.now())

  useEffect(() => {
    trackEvent(bookId, 'modal_open', {
      hotspot_id: hotspot.id,
      page_number: pageNumber,
    })

    return () => {
      const dwell = Date.now() - openedAt.current
      trackEvent(bookId, 'modal_close', {
        hotspot_id: hotspot.id,
        dwell_ms: dwell,
      })
    }
  }, [bookId, hotspot.id, pageNumber])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9998] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60" onClick={onClose} />

        {/* Modal */}
        <motion.div
          className="relative bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[80vh] overflow-y-auto"
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', stiffness: 300, damping: 25 }}
          role="dialog"
          aria-modal="true"
          aria-labelledby="hotspot-modal-title"
        >
          <button
            className="absolute top-4 right-4 text-gray-500 hover:text-gray-800 transition-colors z-10"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {hotspot.modal.media && (
            <div className="relative w-full aspect-video rounded-t-2xl overflow-hidden">
              {hotspot.modal.media.type === 'image' ? (
                <Image
                  src={hotspot.modal.media.src}
                  alt={hotspot.modal.media.alt ?? hotspot.modal.title}
                  fill
                  className="object-cover"
                />
              ) : (
                <video
                  src={hotspot.modal.media.src}
                  poster={hotspot.modal.media.poster}
                  controls
                  muted
                  className="w-full h-full object-cover"
                />
              )}
            </div>
          )}

          <div className="p-6">
            <h2 id="hotspot-modal-title" className="text-xl font-bold text-gray-900 mb-3">
              {hotspot.modal.title}
            </h2>
            <div className="text-gray-700 leading-relaxed whitespace-pre-wrap mb-6">
              {hotspot.modal.body}
            </div>

            {hotspot.action === 'checkout' && hotspot.stripeUrl && (
              <a
                href={hotspot.stripeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent(bookId, 'cta_click', { hotspot_id: hotspot.id, action: 'checkout' })}
                className="block w-full text-center bg-[#0066ff] text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                Buy Now
              </a>
            )}

            {hotspot.action === 'link' && hotspot.linkUrl && (
              <a
                href={hotspot.linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => trackEvent(bookId, 'cta_click', { hotspot_id: hotspot.id, action: 'link' })}
                className="block w-full text-center bg-gray-900 text-white font-semibold py-3 px-4 rounded-xl shadow-lg hover:shadow-xl hover:scale-[1.02] active:scale-[0.98] transition-all"
              >
                View More
              </a>
            )}
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
