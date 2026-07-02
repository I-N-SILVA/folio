'use client'

import { useEffect, useState } from 'react'
import { Download } from 'lucide-react'

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const DISMISSED_KEY = 'klicko-install-dismissed'

/**
 * Surfaces a tasteful "Install KLICKO" button when the browser fires
 * `beforeinstallprompt` (Chromium only; iOS never fires it). Hidden when
 * already running standalone or after the user dismisses it once.
 */
export function InstallPrompt({ className = '' }: { className?: string }) {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null)

  useEffect(() => {
    if (window.matchMedia('(display-mode: standalone)').matches) return
    if (localStorage.getItem(DISMISSED_KEY)) return

    const onPrompt = (e: Event) => {
      e.preventDefault()
      setDeferred(e as BeforeInstallPromptEvent)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    return () => window.removeEventListener('beforeinstallprompt', onPrompt)
  }, [])

  if (!deferred) return null

  async function install() {
    if (!deferred) return
    await deferred.prompt()
    const { outcome } = await deferred.userChoice
    if (outcome === 'dismissed') localStorage.setItem(DISMISSED_KEY, '1')
    setDeferred(null)
  }

  return (
    <button
      onClick={install}
      className={`flex items-center gap-2 rounded-full border border-[var(--folio-border)] bg-white/60 px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--folio-ink)] transition hover:-translate-y-0.5 hover:bg-white ${className}`}
    >
      <Download size={16} />
      Install app
    </button>
  )
}
