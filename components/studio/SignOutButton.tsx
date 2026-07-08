'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LogOut, Loader2 } from 'lucide-react'
import { createBrowserSupabase } from '@/lib/supabase'

export function SignOutButton({ className = '' }: { className?: string }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleSignOut() {
    setLoading(true)
    try {
      await createBrowserSupabase().auth.signOut()
    } finally {
      router.push('/')
      router.refresh()
    }
  }

  return (
    <button
      onClick={handleSignOut}
      disabled={loading}
      className={`inline-flex items-center gap-2 rounded-full border border-[var(--qlico-border)] bg-white/60 px-4 py-2 text-sm font-bold text-[var(--qlico-ink)] transition hover:bg-white disabled:opacity-50 ${className}`}
    >
      {loading ? <Loader2 size={15} className="animate-spin" /> : <LogOut size={15} />}
      Sign out
    </button>
  )
}
