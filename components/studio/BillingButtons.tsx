'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'

async function go(endpoint: string, setLoading: (b: boolean) => void) {
  setLoading(true)
  try {
    const res = await fetch(endpoint, { method: 'POST' })
    const data = await res.json()
    if (!res.ok || !data.url) {
      toast.error(data.error || 'Billing is not available right now.')
      setLoading(false)
      return
    }
    window.location.href = data.url
  } catch {
    toast.error('Network error. Please try again.')
    setLoading(false)
  }
}

export function UpgradeButton({ className = '' }: { className?: string }) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      onClick={() => go('/api/billing/checkout', setLoading)}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[var(--folio-teal)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] disabled:opacity-50 ${className}`}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {loading ? 'Starting…' : 'Upgrade to Pro'}
    </button>
  )
}

export function ManageBillingButton({ className = '' }: { className?: string }) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      onClick={() => go('/api/billing/portal', setLoading)}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-[var(--folio-border)] bg-white/60 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--folio-ink)] transition hover:-translate-y-0.5 hover:bg-white disabled:opacity-50 ${className}`}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {loading ? 'Opening…' : 'Manage billing'}
    </button>
  )
}
