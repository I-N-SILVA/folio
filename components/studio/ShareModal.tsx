'use client'

import { useRef, useState } from 'react'
import { Check, Copy, ExternalLink, QrCode, Share2, Download, Code, Link2, Video, Globe } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { trackProduct } from '@/lib/product-analytics'
import { QRCodeStudioModal } from './QRCodeStudioModal'
import { SocialTeaserModal } from './SocialTeaserModal'
import { generateOfflineBundle } from '@/lib/offline-export'
import { toast } from 'sonner'
import type { Book } from '@/lib/book-schema'

interface ShareModalProps {
  slug: string
  published: boolean
  book?: Book
  onClose: () => void
}

export function ShareModal({ slug, published, book, onClose }: ShareModalProps) {
  const [tab, setTab] = useState<'links' | 'qr'>('links')
  const [showStudio, setShowStudio] = useState(false)
  const [showTeaser, setShowTeaser] = useState(false)
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = `${origin}/book/${slug}`
  const embedCode = `<iframe src="${origin}/embed/${slug}" width="100%" height="600" style="border:0" allowfullscreen title="Interactive edition"></iframe>`
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(url)}&format=svg&margin=10`

  const shareText = `Check out this interactive edition on QLICO:`

  const socialLinks = [
    {
      name: 'X (Twitter)',
      href: `https://twitter.com/intent/tweet?text=${encodeURIComponent(shareText)}&url=${encodeURIComponent(url)}`,
    },
    {
      name: 'LinkedIn',
      href: `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(url)}`,
    },
    {
      name: 'WhatsApp',
      href: `https://api.whatsapp.com/send?text=${encodeURIComponent(`${shareText} ${url}`)}`,
    },
  ]

  const handleExportOfflineHtml = () => {
    if (!book) {
      toast.error('Book data not available for offline bundle export.')
      return
    }
    const html = generateOfflineBundle(book)
    const blob = new Blob([html], { type: 'text/html;charset=utf-8' })
    const blobUrl = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = blobUrl
    a.download = `${slug}-standalone-kiosk.html`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(blobUrl)
    toast.success('Downloaded Standalone Offline Kiosk HTML bundle!')
  }

  const downloadQr = async () => {
    try {
      const res = await fetch(qrUrl)
      const blob = await res.blob()
      const blobUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = blobUrl
      a.download = `${slug}-qr-code.svg`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(blobUrl)
    } catch {
      window.open(qrUrl, '_blank')
    }
  }

  return (
    <Modal
      onClose={onClose}
      title="Share this edition"
      className="max-w-lg p-6 text-[var(--qlico-ink)]"
    >
      <div className="flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">Share edition</h2>
        <div className="flex rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)] p-0.5">
          <button
            type="button"
            onClick={() => setTab('links')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
              tab === 'links'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                : 'text-[var(--qlico-muted)] hover:text-[var(--qlico-ink)]'
            }`}
          >
            <Link2 size={13} />
            Links
          </button>
          <button
            type="button"
            onClick={() => setTab('qr')}
            className={`flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-semibold transition ${
              tab === 'qr'
                ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                : 'text-[var(--qlico-muted)] hover:text-[var(--qlico-ink)]'
            }`}
          >
            <QrCode size={13} />
            QR Code
          </button>
        </div>
      </div>

      {!published && (
        <p className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This edition is still a draft — these links only work once it&apos;s published.
        </p>
      )}

      {/* Flagship Growth Actions Row */}
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          onClick={() => setShowTeaser(true)}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--qlico-border)] bg-[var(--qlico-subtle)] p-2.5 text-xs font-bold text-[var(--qlico-ink)] transition hover:bg-[var(--tint)] shadow-sm"
        >
          <Video size={14} className="text-violet-600" />
          Social Teaser Studio
        </button>
        <button
          type="button"
          onClick={handleExportOfflineHtml}
          className="flex items-center justify-center gap-1.5 rounded-xl border border-[var(--qlico-border)] bg-[var(--qlico-subtle)] p-2.5 text-xs font-bold text-[var(--qlico-ink)] transition hover:bg-[var(--tint)] shadow-sm"
        >
          <Download size={14} className="text-emerald-600" />
          Offline Kiosk HTML
        </button>
      </div>

      {tab === 'links' ? (
        <div className="space-y-4 mt-2">
          <CopyField label="Direct link" value={url} kind="link" />
          <CopyField label="Embed code" value={embedCode} multiline kind="embed" />

          {/* Social share row */}
          <div className="mt-5 border-t border-[var(--qlico-border)] pt-4">
            <p className="mb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--qlico-muted)]">
              Broadcast
            </p>
            <div className="flex flex-wrap gap-2">
              {socialLinks.map((s) => (
                <a
                  key={s.name}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--qlico-ink)] transition-colors hover:bg-[var(--tint)]"
                >
                  {s.name}
                </a>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="mt-5 flex flex-col items-center justify-center p-4 text-center">
          <div className="overflow-hidden rounded-2xl border-4 border-white bg-white p-3 shadow-xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={qrUrl} alt={`QR Code for ${slug}`} width={180} height={180} className="h-44 w-44" />
          </div>
          <p className="mt-3 text-xs text-[var(--qlico-muted)]">
            Scan with any phone camera to open the edition directly.
          </p>
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => setShowStudio(true)}
              className="flex items-center gap-1.5 rounded-full bg-[var(--invert-surface)] px-5 py-2.5 text-xs font-bold text-[var(--invert-text)] border border-neutral-700 transition hover:bg-neutral-800"
            >
              <QrCode size={14} />
              Open Print QR Studio
            </button>
            <button
              type="button"
              onClick={downloadQr}
              className="flex items-center gap-1.5 rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)] px-4 py-2.5 text-xs font-bold text-[var(--qlico-ink)] transition hover:bg-[var(--tint)]"
            >
              <Download size={14} />
              Quick SVG
            </button>
          </div>
        </div>
      )}

      {showStudio && (
        <QRCodeStudioModal
          isOpen={showStudio}
          onClose={() => setShowStudio(false)}
          bookTitle={book?.title || ''}
          bookSlug={slug}
        />
      )}

      {showTeaser && book && (
        <SocialTeaserModal
          isOpen={showTeaser}
          onClose={() => setShowTeaser(false)}
          book={book}
        />
      )}

      {published && (
        <div className="mt-5 flex items-center justify-between border-t border-[var(--qlico-border)] pt-4">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-fg)] hover:underline"
          >
            Open live edition
            <ExternalLink size={14} />
          </a>
        </div>
      )}
    </Modal>
  )
}

function CopyField({
  label,
  value,
  multiline = false,
  kind,
}: {
  label: string
  value: string
  multiline?: boolean
  /** Which artifact was taken — the step that turns a publish into a reader. */
  kind: 'link' | 'embed'
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  async function copy() {
    try {
      if (!navigator.clipboard) throw new Error('unavailable')
      await navigator.clipboard.writeText(value)
      trackProduct('share_link_copied', { kind })
      setState('copied')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      fieldRef.current?.select()
      setState('manual')
    }
  }

  const shared =
    'w-full rounded-xl border border-[var(--qlico-border)] bg-[var(--qlico-subtle)] px-3 py-2.5 font-mono text-xs text-[var(--qlico-ink)] outline-none focus:border-[var(--accent)]'

  return (
    <div className="mt-4">
      <div className="mb-1.5 flex items-center justify-between gap-2">
        <label className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--qlico-muted)]">
          {label}
        </label>
        <button
          type="button"
          onClick={copy}
          className="flex items-center gap-1.5 rounded-full px-2 py-1 text-xs font-semibold text-[var(--qlico-muted)] transition-colors hover:bg-[var(--tint)] hover:text-[var(--qlico-ink)]"
        >
          {state === 'copied' ? (
            <>
              <Check size={13} className="text-emerald-600" />
              Copied
            </>
          ) : (
            <>
              <Copy size={13} />
              Copy
            </>
          )}
        </button>
      </div>

      {multiline ? (
        <textarea
          ref={fieldRef}
          readOnly
          rows={3}
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className={`${shared} resize-none leading-relaxed`}
        />
      ) : (
        <input
          ref={fieldRef}
          readOnly
          value={value}
          onFocus={(e) => e.currentTarget.select()}
          className={shared}
        />
      )}

      {state === 'manual' && (
        <p className="mt-1.5 text-[11px] text-[var(--qlico-muted)]" role="status">
          Your browser blocked clipboard access — the text is selected, so copy it
          with your keyboard.
        </p>
      )}
    </div>
  )
}
