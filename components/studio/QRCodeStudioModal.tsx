'use client'

import { useState, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { QrCode, Download, X, Copy, Check, Sparkles, Printer } from 'lucide-react'
import { toast } from 'sonner'

export function QRCodeStudioModal({
  isOpen,
  onClose,
  bookTitle,
  bookSlug,
}: {
  isOpen: boolean
  onClose: () => void
  bookTitle: string
  bookSlug: string
}) {
  const [frameStyle, setFrameStyle] = useState<'minimal' | 'card' | 'tag' | 'audio'>('card')
  const [ctaText, setCtaText] = useState('Scan to read interactive edition')
  const [copied, setCopied] = useState(false)
  const qrRef = useRef<HTMLDivElement>(null)

  const publicationUrl = `https://qlico.app/book/${bookSlug}`
  // Quick Google Chart API QR Generator for crystal clear vector preview
  const qrApiUrl = `https://api.qrserver.com/v1/create-qr-code/?size=600x600&data=${encodeURIComponent(
    publicationUrl
  )}&margin=1&format=svg`

  const handleCopyLink = () => {
    navigator.clipboard.writeText(publicationUrl)
    setCopied(true)
    toast.success('Public URL copied to clipboard')
    setTimeout(() => setCopied(false), 2000)
  }

  const handleDownload = (format: 'svg' | 'png') => {
    const link = document.createElement('a')
    link.href = `https://api.qrserver.com/v1/create-qr-code/?size=1200x1200&data=${encodeURIComponent(
      publicationUrl
    )}&margin=2&format=${format}`
    link.download = `${bookSlug}-qlico-qr.${format}`
    link.target = '_blank'
    link.click()
    toast.success(`Downloaded ${format.toUpperCase()} QR code`)
  }

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/75 backdrop-blur-md"
          />

          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            className="relative z-10 flex w-full max-w-2xl flex-col overflow-hidden rounded-3xl border border-neutral-800 bg-[#0a0a0c] text-white shadow-2xl"
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-neutral-800 p-6">
              <div className="flex items-center gap-3">
                <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/10 text-white">
                  <QrCode size={20} />
                </div>
                <div>
                  <h2 className="font-display text-xl font-semibold tracking-tight">Print QR Studio</h2>
                  <p className="text-xs text-zinc-400">Export high-resolution vector codes for physical print</p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="grid h-8 w-8 place-items-center rounded-full text-zinc-400 transition-colors hover:bg-white/10 hover:text-white"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content Body */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 p-6">
              {/* Live Preview Card */}
              <div className="flex flex-col items-center justify-center rounded-2xl border border-neutral-800 bg-neutral-950/80 p-6 text-center">
                <div
                  ref={qrRef}
                  className={`flex flex-col items-center justify-center rounded-2xl bg-white p-6 text-black shadow-xl transition-all ${
                    frameStyle === 'tag'
                      ? 'rounded-t-[2.5rem] border-t-8 border-black'
                      : frameStyle === 'card'
                      ? 'border border-neutral-200'
                      : ''
                  }`}
                >
                  {/* Top Branding / Title */}
                  <div className="mb-3 text-center">
                    <p className="font-display text-sm font-bold tracking-tight uppercase">
                      {bookTitle || 'QLICO Edition'}
                    </p>
                    <p className="text-[10px] text-zinc-500 font-mono tracking-wider">
                      {frameStyle === 'audio' ? 'AUDIOBOOK EDITION' : 'VOL. 01 · INTERACTIVE'}
                    </p>
                  </div>

                  {/* QR Image with Monogram Center Badge */}
                  <div className="relative h-44 w-44 rounded-lg bg-white p-2">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrApiUrl}
                      alt="Publication QR Code"
                      className="h-full w-full object-contain"
                    />
                    {/* Centered QLICO Monogram Badge */}
                    <div className="absolute inset-0 m-auto grid h-10 w-10 place-items-center rounded-full border-2 border-white bg-black shadow-md">
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        viewBox="0 0 512 512"
                        width="20"
                        height="20"
                      >
                        <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
                          <circle cx="236" cy="236" r="132" strokeWidth="44" />
                          <path d="M 296 296 L 396 396" strokeWidth="44" />
                          <path d="M 326 396 H 396 V 326" strokeWidth="44" />
                        </g>
                      </svg>
                    </div>
                  </div>

                  {/* Bottom CTA Text */}
                  <p className="mt-3 max-w-[180px] text-center text-xs font-semibold text-zinc-800 leading-tight">
                    {ctaText}
                  </p>
                </div>
              </div>

              {/* Customization Controls */}
              <div className="flex flex-col justify-between space-y-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mb-2">
                    Frame Style
                  </label>
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'card', label: 'Minimal Card' },
                      { id: 'minimal', label: 'Raw Vector' },
                      { id: 'tag', label: 'Hang Tag / Label' },
                      { id: 'audio', label: 'Audio Tour' },
                    ].map((f) => (
                      <button
                        key={f.id}
                        onClick={() => {
                          setFrameStyle(f.id as any)
                          if (f.id === 'audio') setCtaText('Scan to listen to audio narration')
                          else if (f.id === 'tag') setCtaText('Scan to shop interactive collection')
                          else setCtaText('Scan to read interactive edition')
                        }}
                        className={`rounded-xl border p-2.5 text-left text-xs font-medium transition-colors ${
                          frameStyle === f.id
                            ? 'border-white bg-white/10 text-white'
                            : 'border-neutral-800 bg-neutral-900/60 text-zinc-400 hover:text-white'
                        }`}
                      >
                        {f.label}
                      </button>
                    ))}
                  </div>

                  <label className="block text-xs font-semibold uppercase tracking-wider text-zinc-400 mt-4 mb-2">
                    Custom Callout Text
                  </label>
                  <input
                    type="text"
                    value={ctaText}
                    onChange={(e) => setCtaText(e.target.value)}
                    className="w-full rounded-xl border border-neutral-800 bg-neutral-900 px-3 py-2 text-xs text-white outline-none focus:border-zinc-500"
                  />

                  <div className="mt-4 rounded-xl border border-neutral-800/80 bg-neutral-950 p-3 text-[11px] text-zinc-400 flex items-start gap-2">
                    <Printer size={14} className="shrink-0 text-zinc-500 mt-0.5" />
                    <span>Vector SVGs remain tack-sharp at any print size from 2x2cm packaging stickers to billboard posters.</span>
                  </div>
                </div>

                {/* Download Actions */}
                <div className="space-y-2 pt-2 border-t border-neutral-800">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleDownload('svg')}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-full bg-white py-2.5 text-xs font-semibold text-black transition hover:bg-zinc-200"
                    >
                      <Download size={13} />
                      Download SVG (Vector)
                    </button>
                    <button
                      onClick={() => handleDownload('png')}
                      className="flex-1 flex items-center justify-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-800 py-2.5 text-xs font-semibold text-white transition hover:bg-neutral-700"
                    >
                      <Download size={13} />
                      Download PNG (300 DPI)
                    </button>
                  </div>
                  <button
                    onClick={handleCopyLink}
                    className="w-full flex items-center justify-center gap-1.5 py-1.5 text-xs text-zinc-400 hover:text-white transition"
                  >
                    {copied ? <Check size={12} className="text-green-400" /> : <Copy size={12} />}
                    {copied ? 'Copied link!' : 'Copy direct URL'}
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
