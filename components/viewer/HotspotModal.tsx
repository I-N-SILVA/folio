'use client'

import { useEffect, useRef } from 'react'
import Image from 'next/image'
import { trackEvent } from '@/lib/tracking'
import { Modal, Z } from '@/components/ui/Modal'
import type { Hotspot } from '@/lib/book-schema'

interface HotspotModalProps {
  hotspot: Hotspot
  bookId: string
  pageNumber: number
  onClose: () => void
}

/**
 * The dialog behind a hotspot — the payoff for the product's flagship
 * interaction, and the only dialog a reader ever opens.
 *
 * Rebuilt on the shared `Modal` primitive. It used to hand-roll its own portal,
 * which meant it had none of what that primitive provides: focus never moved
 * into the dialog, Tab walked straight out into the page behind it, the page
 * kept scrolling underneath, and focus was not returned to the hotspot on close.
 * On the reader — the highest-traffic surface in the product, and the one served
 * to people who did not choose to be here — that is the accessibility bug worth
 * fixing first.
 *
 * The panel keeps its own light styling rather than the app's theme tokens: it
 * sits over author content under an author-chosen theme, so it is deliberately
 * neutral in both modes.
 */
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

  return (
    <Modal
      onClose={onClose}
      title={hotspot.modal.title || hotspot.label}
      z={Z.reader}
      hideCloseButton
      className="max-h-[80vh] max-w-lg overflow-y-auto rounded-2xl bg-white text-gray-900"
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close"
        className="absolute right-4 top-4 z-10 grid h-8 w-8 place-items-center rounded-full bg-white/80 text-gray-500 backdrop-blur transition-colors hover:text-gray-900"
      >
        {/* Inline rather than the lucide X: this panel is white in both themes,
            and the shared button styling follows the app's tokens. */}
        <svg
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
        >
          <path d="M18 6 6 18M6 6l12 12" />
        </svg>
      </button>

      {hotspot.modal.media && (
        <div className="relative aspect-video w-full overflow-hidden rounded-t-2xl">
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
              className="h-full w-full object-cover"
            />
          )}
        </div>
      )}

      <div className="p-6">
        <h2 className="mb-3 text-xl font-bold text-gray-900">{hotspot.modal.title}</h2>
        <div className="mb-6 whitespace-pre-wrap leading-relaxed text-gray-700">
          {hotspot.modal.body}
        </div>

        {hotspot.action === 'checkout' && (
          <div>
            {hotspot.price && (
              <div className="mb-4 flex items-baseline gap-2">
                <span className="text-3xl font-semibold tracking-[-0.02em] text-gray-900">
                  {hotspot.price}
                </span>
                <span className="text-sm text-gray-500">incl. taxes</span>
              </div>
            )}

            {hotspot.stripeUrl ? (
              <a
                href={hotspot.stripeUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() =>
                  trackEvent(bookId, 'cta_click', { hotspot_id: hotspot.id, action: 'checkout' })
                }
                className="block w-full rounded-full bg-neutral-900 px-4 py-3.5 text-center font-semibold text-white shadow-lg transition-all hover:bg-black hover:scale-[1.01] active:scale-[0.98]"
              >
                {hotspot.ctaLabel ?? 'Buy Now'}
              </a>
            ) : (
              <button
                type="button"
                onClick={() => {
                  trackEvent(bookId, 'cta_click', { hotspot_id: hotspot.id, action: 'checkout' })
                  const numeric = parseFloat((hotspot.price || '0').replace(/[^0-9.]/g, '')) || 0
                  if (typeof window !== 'undefined') {
                    window.dispatchEvent(
                      new CustomEvent('folio:add-to-cart', {
                        detail: {
                          id: hotspot.id,
                          title: hotspot.modal.title || hotspot.label || 'Boutique Piece',
                          price: hotspot.price || '$0',
                          numericPrice: numeric,
                          image: hotspot.modal.media?.type === 'image' ? hotspot.modal.media.src : undefined,
                          pageNumber,
                        },
                      })
                    )
                  }
                  onClose()
                }}
                className="flex w-full items-center justify-center gap-2 rounded-full bg-neutral-900 px-4 py-3.5 text-center font-semibold text-white shadow-lg transition-all hover:bg-black hover:scale-[1.01] active:scale-[0.98]"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M6 2 3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4Z" />
                  <path d="M3 6h18" />
                  <path d="M16 10a4 4 0 0 1-8 0" />
                </svg>
                <span>{hotspot.ctaLabel ?? 'Add to Bag'}</span>
              </button>
            )}
          </div>
        )}

        {hotspot.action === 'link' && hotspot.linkUrl && (
          <a
            href={hotspot.linkUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={() =>
              trackEvent(bookId, 'cta_click', { hotspot_id: hotspot.id, action: 'link' })
            }
            className="block w-full rounded-xl bg-gray-900 px-4 py-3 text-center font-semibold text-white shadow-lg transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]"
          >
            {hotspot.ctaLabel ?? 'View more'}
          </a>
        )}
      </div>
    </Modal>
  )
}
