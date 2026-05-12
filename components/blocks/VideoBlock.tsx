'use client'

import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import Image from 'next/image'
import { Play, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { trackEvent } from '@/lib/tracking'
import type { VideoBlock } from '@/lib/book-schema'

function VideoModal({
  src,
  bookId,
  blockId,
  onClose,
}: {
  src: string
  bookId: string
  blockId: string
  onClose: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const openedAt = useRef(Date.now())

  useEffect(() => {
    trackEvent(bookId, 'video_play', { block_id: blockId })
    return () => {
      const pct = videoRef.current
        ? Math.round((videoRef.current.currentTime / videoRef.current.duration) * 100)
        : 0
      trackEvent(bookId, 'video_complete', { block_id: blockId, percent_watched: pct })
    }
  }, [bookId, blockId])

  useEffect(() => {
    const handler = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onClose])

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center bg-black/90"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
      >
        <motion.div
          className="relative w-full max-w-4xl mx-4"
          initial={{ scale: 0.9 }}
          animate={{ scale: 1 }}
          exit={{ scale: 0.9 }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="absolute -top-10 right-0 text-white hover:text-gray-300 transition-colors"
            onClick={onClose}
            aria-label="Close video"
          >
            <X size={28} />
          </button>
          <video
            ref={videoRef}
            src={src}
            controls
            autoPlay
            muted
            className="w-full rounded-lg"
          />
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}

export function VideoBlock({ block, bookId }: { block: VideoBlock; bookId: string }) {
  const [modalOpen, setModalOpen] = useState(false)

  return (
    <>
      <div
        className="relative w-full aspect-video rounded overflow-hidden cursor-pointer group"
        onClick={() => setModalOpen(true)}
        role="button"
        aria-label={`Play video`}
      >
        <Image
          src={block.poster}
          alt="Video thumbnail"
          fill
          className="object-cover group-hover:scale-105 transition-transform duration-300"
          sizes="(max-width: 768px) 100vw, 50vw"
        />
        <div className="absolute inset-0 flex items-center justify-center bg-black/30 group-hover:bg-black/40 transition-colors">
          <div className="bg-white/90 rounded-full p-4 shadow-lg group-hover:scale-110 transition-transform">
            <Play size={32} className="text-gray-900 ml-1" fill="currentColor" />
          </div>
        </div>
      </div>

      {modalOpen && (
        <VideoModal
          src={block.src}
          bookId={bookId}
          blockId={block.id}
          onClose={() => setModalOpen(false)}
        />
      )}
    </>
  )
}
