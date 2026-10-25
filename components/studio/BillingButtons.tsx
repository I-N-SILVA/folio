'use client'

import { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { trackProduct } from '@/lib/product-analytics'
import type { BillingInterval } from '@/lib/plans'

async function go(endpoint: string, setLoading: (b: boolean) => void, body?: unknown) {
  setLoading(true)
  try {
    const res = await fetch(endpoint, {
      method: 'POST',
      ...(body === undefined
        ? {}
        : { headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    })
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

export function UpgradeButton({
  className = '',
  interval = 'month',
  label = 'Upgrade to Pro',
}: {
  className?: string
  interval?: BillingInterval
  label?: string
}) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      onClick={() => {
        trackProduct('checkout_started', { plan: 'pro', interval })
        go('/api/billing/checkout', setLoading, { interval })
      }}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full bg-[var(--accent)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--accent-contrast)] transition hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] disabled:opacity-50 ${className}`}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {loading ? 'Starting…' : label}
    </button>
  )
}

export function ManageBillingButton({ className = '' }: { className?: string }) {
  const [loading, setLoading] = useState(false)
  return (
    <button
      onClick={() => go('/api/billing/portal', setLoading)}
      disabled={loading}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/60 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--qlico-ink)] transition hover:-translate-y-0.5 hover:bg-[var(--qlico-paper)] disabled:opacity-50 ${className}`}
    >
      {loading && <Loader2 size={15} className="animate-spin" />}
      {loading ? 'Opening…' : 'Manage billing'}
    </button>
  )
}
