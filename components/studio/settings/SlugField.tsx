'use client'

import { useState } from 'react'
import { Check, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { useEditorStore } from '@/lib/editor-store'
import { Field, inputCls } from './shared'

/**
 * Renames an edition's public address.
 *
 * Saved on its own rather than through the editor's autosave, because it is not
 * like the other settings: it can fail for a reason the author has to act on
 * (the link is taken), and it has a consequence worth confirming (the old address
 * starts redirecting). A field that quietly participated in a debounced save
 * couldn't say either of those things.
 */
export function SlugField({ bookId, slug }: { bookId: string; slug: string }) {
  const [value, setValue] = useState(slug)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  const normalised = value.toLowerCase().replace(/[^a-z0-9-]/g, '')
  const changed = normalised !== slug && normalised.length > 0

  async function rename() {
    if (!changed || saving) return
    setSaving(true)
    setError('')
    try {
      const res = await fetch(`/api/books/${bookId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ slug: normalised }),
      })
      const payload = await res.json().catch(() => ({}))

      if (!res.ok) {
        setError(typeof payload.error === 'string' ? payload.error : 'Could not change the link.')
        return
      }

      // The store holds the slug that the share dialog and "view live" use, so
      // it has to learn about this without a reload.
      useEditorStore.setState((state) => ({
        book: state.book ? { ...state.book, slug: normalised } : state.book,
      }))
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
      toast.success('Link changed — the old one now redirects here.')
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Field
      label="Public address"
      hint="Anything already shared at the old address keeps working — it redirects here."
    >
      <div className="flex items-center gap-2">
        <div className="flex min-w-0 flex-1 items-center overflow-hidden rounded-lg border border-neutral-700/80 bg-neutral-950/60 focus-within:border-[var(--studio-select)]">
          <span className="shrink-0 border-r border-neutral-700/80 px-2 py-2 text-xs text-neutral-500">
            /book/
          </span>
          <input
            value={normalised}
            onChange={(e) => {
              setValue(e.target.value)
              setError('')
            }}
            onKeyDown={(e) => e.key === 'Enter' && rename()}
            aria-invalid={Boolean(error)}
            aria-describedby={error ? 'slug-error' : undefined}
            className="min-w-0 flex-1 bg-transparent px-2 py-2 text-sm text-neutral-100 outline-none"
          />
        </div>
        <button
          type="button"
          onClick={rename}
          disabled={!changed || saving}
          className="shrink-0 rounded-lg bg-[var(--studio-select)] px-3 py-2 text-xs font-semibold text-white transition-colors hover:bg-[var(--studio-select)] disabled:opacity-40"
        >
          {saving ? (
            <Loader2 size={13} className="animate-spin" />
          ) : saved ? (
            <Check size={13} />
          ) : (
            'Change'
          )}
        </button>
      </div>
      {error && (
        <p id="slug-error" role="alert" className="mt-1.5 text-[11px] leading-4 text-red-400">
          {error}
        </p>
      )}
    </Field>
  )
}
