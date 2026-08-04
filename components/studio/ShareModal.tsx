'use client'

import { useRef, useState } from 'react'
import { Check, Copy, ExternalLink } from 'lucide-react'
import { Modal } from '@/components/ui/Modal'

interface ShareModalProps {
  slug: string
  published: boolean
  onClose: () => void
}

/**
 * This existed but nothing imported it, so the app had no share surface at all:
 * no way to copy an edition's link, and no way to obtain the embed snippet —
 * a reader would have had to construct /embed/<slug> by hand. Rebuilt on the
 * shared dialog primitive (focus trap, Escape, scroll lock) and wired into the
 * editor and the library card.
 */
export function ShareModal({ slug, published, onClose }: ShareModalProps) {
  const origin = typeof window !== 'undefined' ? window.location.origin : ''
  const url = `${origin}/book/${slug}`
  const embedCode = `<iframe src="${origin}/embed/${slug}" width="100%" height="600" style="border:0" allowfullscreen title="Interactive edition"></iframe>`

  return (
    <Modal
      onClose={onClose}
      title="Share this edition"
      className="max-w-lg p-6 text-[var(--qlico-ink)]"
    >
      <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">Share this edition</h2>

      {!published && (
        <p className="mt-3 rounded-xl border border-amber-300/60 bg-amber-50 px-3 py-2 text-sm text-amber-900">
          This edition is still a draft — these links only work once it&apos;s published.
        </p>
      )}

      <CopyField label="Direct link" value={url} />
      <CopyField label="Embed code" value={embedCode} multiline />

      {published && (
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-5 inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--accent-fg)] hover:underline"
        >
          Open the live edition
          <ExternalLink size={14} />
        </a>
      )}
    </Modal>
  )
}

function CopyField({
  label,
  value,
  multiline = false,
}: {
  label: string
  value: string
  multiline?: boolean
}) {
  const [state, setState] = useState<'idle' | 'copied' | 'manual'>('idle')
  const fieldRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null)

  async function copy() {
    // navigator.clipboard is undefined on insecure origins and in some
    // in-app browsers. The previous version called it unguarded, so a copy
    // there threw an unhandled rejection and appeared to do nothing at all.
    try {
      if (!navigator.clipboard) throw new Error('unavailable')
      await navigator.clipboard.writeText(value)
      setState('copied')
      setTimeout(() => setState('idle'), 2000)
    } catch {
      // Fall back to selecting the text so it can be copied by hand, and say so.
      fieldRef.current?.select()
      setState('manual')
    }
  }

  const shared =
    'w-full rounded-xl border border-[var(--qlico-border)] bg-[var(--qlico-subtle)] px-3 py-2.5 font-mono text-xs text-[var(--qlico-ink)] outline-none focus:border-[var(--accent)]'

  return (
    <div className="mt-5">
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

      {/* A real field rather than a span: selectable, keyboard-reachable, and it
          gives the clipboard fallback something to select. */}
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
