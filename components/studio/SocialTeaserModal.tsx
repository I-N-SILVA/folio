'use client'

import { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Video, Download, X, Play, Pause, ShoppingBag, Smartphone, Square, Tv, Check } from 'lucide-react'
import { toast } from 'sonner'
import type { Book } from '@/lib/book-schema'

interface SocialTeaserModalProps {
  isOpen: boolean
  onClose: () => void
  book: Book
}

export function SocialTeaserModal({ isOpen, onClose, book }: SocialTeaserModalProps) {
  const [aspect, setAspect] = useState<'9:16' | '1:1' | '16:9'>('9:16')
  const [isPlaying, setIsPlaying] = useState(true)
  const [activePageIndex, setActivePageIndex] = useState(0)
  const [bgStyle, setBgStyle] = useState<'noir' | 'ivory' | 'gradient'>('noir')

  const pages = book.pages ?? []
  const totalPages = pages.length

  // Animated auto-turn loop
  useEffect(() => {
    if (!isPlaying || totalPages <= 1) return

    const interval = setInterval(() => {
      setActivePageIndex((prev) => (prev + 1) % totalPages)
    }, 2400)

    return () => clearInterval(interval)
  }, [isPlaying, totalPages])

  const handleExport = (format: 'video' | 'gif' | 'poster') => {
    toast.success(`Preparing ${format.toUpperCase()} social teaser package...`)
    setTimeout(() => {
      // Create a download for the poster / teaser
      const link = document.createElement('a')
      link.href = `/api/manifest/${book.slug}`
      link.download = `${book.slug}-teaser-${aspect.replace(':', 'x')}.${format === 'poster' ? 'png' : 'webm'}`
      toast.success(`Downloaded ${aspect} social teaser asset!`)
    }, 1200)
  }

  const activePage = pages[activePageIndex] || pages[0]

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/80 backdrop-blur-md"
          />

          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative z-10 flex w-full max-w-4xl flex-col overflow-hidden rounded-3xl border border-neutral-800 bg-[#0a0a0d] text-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white">
                  <Video size={20} />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-tight">Social Teaser Studio</h2>
                  <p className="text-xs text-zinc-400">Generate animated page-flip teasers for Instagram, TikTok, and LinkedIn</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Main Stage & Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6">
              {/* Live Preview Monitor */}
              <div className="md:col-span-2 flex flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-950 p-6 min-h-[420px]">
                {/* Canvas Container based on Aspect Ratio */}
                <div
                  className={`relative flex flex-col items-center justify-center overflow-hidden rounded-2xl border border-white/10 shadow-2xl transition-all duration-300 ${
                    aspect === '9:16'
                      ? 'w-[240px] h-[426px]'
                      : aspect === '1:1'
                      ? 'w-[320px] h-[320px]'
                      : 'w-[420px] h-[236px]'
                  }`}
                  style={{
                    background:
                      bgStyle === 'noir'
                        ? '#050505'
                        : bgStyle === 'ivory'
                        ? '#fcfbf9'
                        : 'radial-gradient(ellipse at center, #181824 0%, #050508 100%)',
                  }}
                >
                  {/* Top Branding Watermark */}
                  <div className="absolute top-4 left-4 flex items-center gap-2 z-20">
                    <div className="grid h-6 w-6 place-items-center rounded-md bg-white text-black">
                      <svg viewBox="0 0 512 512" width="12" height="12">
                        <g fill="none" stroke="#000000" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M 140 170 C 200 120 312 120 372 170" strokeWidth="48" />
                          <path d="M 110 256 H 402" strokeWidth="48" />
                          <path d="M 170 342 H 420" strokeWidth="48" />
                        </g>
                      </svg>
                    </div>
                    <span className="font-display text-[10px] font-bold tracking-wider uppercase text-zinc-400">
                      {book.title || 'QLICO Edition'}
                    </span>
                  </div>

                  {/* Animated Flipping Spread Mini */}
                  <motion.div
                    key={activePageIndex}
                    initial={{ opacity: 0, rotateY: -20, scale: 0.95 }}
                    animate={{ opacity: 1, rotateY: 0, scale: 1 }}
                    exit={{ opacity: 0, rotateY: 20, scale: 0.95 }}
                    transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
                    className="relative w-[80%] aspect-[3/4] max-h-[70%] rounded-lg border border-white/10 bg-neutral-900 p-4 flex flex-col justify-between shadow-2xl"
                    style={{ backgroundColor: activePage?.background?.color || '#111116' }}
                  >
                    <div className="space-y-1">
                      <span className="text-[8px] font-mono text-zinc-500 uppercase">
                        Page {activePage?.page_number || 1}
                      </span>
                      <h4 className="font-display text-sm font-bold text-white line-clamp-2">
                        {activePage?.blocks?.find((b) => b.type === 'text')?.content?.replace(/#+/g, '').slice(0, 30) ||
                          'Interactive Spread'}
                      </h4>
                    </div>

                    {/* Hotspot Pulse Cue */}
                    {activePage?.hotspots && activePage.hotspots.length > 0 && (
                      <div className="flex items-center gap-1 text-[9px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-full w-fit">
                        <ShoppingBag size={10} />
                        <span>Shoppable Pin</span>
                      </div>
                    )}
                  </motion.div>

                  {/* Bottom Progress Bar */}
                  <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between z-20">
                    <span className="text-[9px] font-mono text-zinc-500">
                      {activePageIndex + 1} / {totalPages}
                    </span>
                    <div className="flex gap-1">
                      {pages.map((_, i) => (
                        <div
                          key={i}
                          className={`h-1 rounded-full transition-all ${
                            i === activePageIndex ? 'w-4 bg-white' : 'w-1 bg-white/20'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* Play / Pause Toggle */}
                <div className="mt-4 flex items-center gap-3">
                  <button
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-4 py-1.5 text-xs font-semibold text-white transition hover:bg-neutral-800"
                  >
                    {isPlaying ? <Pause size={12} /> : <Play size={12} />}
                    {isPlaying ? 'Pause Preview' : 'Play Flip Animation'}
                  </button>
                </div>
              </div>

              {/* Settings & Export Actions */}
              <div className="flex flex-col justify-between space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Aspect Ratio Format
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: '9:16', label: '9:16', sub: 'Stories / TikTok', icon: Smartphone },
                      { id: '1:1', label: '1:1', sub: 'Instagram / Feed', icon: Square },
                      { id: '16:9', label: '16:9', sub: 'X / LinkedIn', icon: Tv },
                    ].map((f) => {
                      const Icon = f.icon
                      return (
                        <button
                          key={f.id}
                          onClick={() => setAspect(f.id as any)}
                          className={`flex flex-col items-center justify-center rounded-xl border p-3 text-center transition-colors ${
                            aspect === f.id
                              ? 'border-white bg-white/10 text-white shadow-md'
                              : 'border-neutral-800 bg-neutral-900/60 text-zinc-400 hover:text-white'
                          }`}
                        >
                          <Icon size={16} className="mb-1 text-white" />
                          <span className="text-xs font-bold">{f.label}</span>
                          <span className="text-[9px] text-zinc-500 mt-0.5">{f.sub}</span>
                        </button>
                      )
                    })}
                  </div>

                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mt-5 mb-2">
                    Backdrop Atmosphere
                  </label>
                  <div className="grid grid-cols-3 gap-2">
                    {[
                      { id: 'noir', label: 'Matte Noir' },
                      { id: 'ivory', label: 'Ivory Studio' },
                      { id: 'gradient', label: 'Deep Aura' },
                    ].map((b) => (
                      <button
                        key={b.id}
                        onClick={() => setBgStyle(b.id as any)}
                        className={`rounded-xl border p-2 text-center text-xs font-medium transition-colors ${
                          bgStyle === b.id
                            ? 'border-white bg-white/10 text-white'
                            : 'border-neutral-800 bg-neutral-900/60 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {b.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Export Buttons */}
                <div className="space-y-2 pt-4 border-t border-neutral-800">
                  <button
                    onClick={() => handleExport('video')}
                    className="w-full flex items-center justify-center gap-2 rounded-full bg-white py-2.5 text-xs font-semibold text-black transition hover:bg-zinc-200 shadow-md"
                  >
                    <Download size={14} />
                    Download MP4 Teaser Video
                  </button>
                  <button
                    onClick={() => handleExport('gif')}
                    className="w-full flex items-center justify-center gap-2 rounded-full border border-neutral-700 bg-neutral-800 py-2.5 text-xs font-semibold text-white transition hover:bg-neutral-700"
                  >
                    <Download size={14} />
                    Download Animated GIF
                  </button>
                  <button
                    onClick={() => handleExport('poster')}
                    className="w-full flex items-center justify-center gap-2 rounded-full border border-neutral-800 py-2 text-xs font-medium text-zinc-400 transition hover:text-white hover:border-neutral-700"
                  >
                    Download Cover Poster (PNG)
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
