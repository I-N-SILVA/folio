'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

/**
 * The switch the weekly digest's unsubscribe line promises.
 *
 * Optimistic, because the alternative is a checkbox that lags behind the click
 * for a round trip — and it reverts with an explanation if the save fails, which
 * is the only case where the lag would have told the user anything.
 */
export function DigestToggle({ initial }: { initial: boolean }) {
  const [optOut, setOptOut] = useState(initial)
  const [saving, setSaving] = useState(false)

  async function toggle(next: boolean) {
    setOptOut(next)
    setSaving(true)
    try {
      const res = await fetch('/api/account/preferences', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ digestOptOut: next }),
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        throw new Error(payload.error || 'Could not save that.')
      }
    } catch (err) {
      setOptOut(!next)
      toast.error(err instanceof Error ? err.message : 'Could not save that.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <label className="flex cursor-pointer items-start gap-3">
      <input
        type="checkbox"
        checked={!optOut}
        disabled={saving}
        onChange={(e) => toggle(!e.target.checked)}
        className="mt-0.5 h-4 w-4 shrink-0 rounded border-[var(--qlico-border)] accent-[var(--accent)]"
      />
      <span className="text-sm leading-6">
        <span className="font-semibold">Weekly reader summary</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[13px] text-[var(--qlico-muted)]">
          Readers, completion and captured emails across your editions.
          {saving && <Loader2 size={12} className="animate-spin" />}
        </span>
      </span>
    </label>
  )
}
