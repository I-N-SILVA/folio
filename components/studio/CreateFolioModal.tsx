'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, FileText, Layout, Image as ImageIcon, Loader2, Crown } from 'lucide-react'
import { toast } from 'sonner'
import { ImportPDFModal } from './ImportPDFModal'
import { createBrowserSupabase } from '@/lib/supabase'

interface Props {
  onClose: () => void
}

type Quota = { used: number; limit: number | null; allowed: boolean; planName: string }

function isLimitError(message: string) {
  return /BOOK_LIMIT_REACHED|plan_limit|plan's limit/i.test(message)
}

export function CreateFolioModal({ onClose }: Props) {
  const [step, setStep] = useState<'choice' | 'pdf' | 'images' | 'name-blank'>('choice')
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [limitHit, setLimitHit] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createBrowserSupabase()

  // Fetch the user's quota so we can pre-empt creation when they're capped.
  useEffect(() => {
    let active = true
    fetch('/api/entitlements')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!active || !d) return
        setQuota({ used: d.books.used, limit: d.books.limit, allowed: d.books.allowed, planName: d.planName })
        if (!d.books.allowed) setLimitHit(true)
      })
      .catch(() => {})
    return () => {
      active = false
    }
  }, [])

  const guardLimit = (err: unknown): boolean => {
    const message = err instanceof Error ? err.message : String(err)
    if (isLimitError(message)) {
      setLimitHit(true)
      setLoading(false)
      return true
    }
    return false
  }

  const handleCreateBlank = async (e?: React.FormEvent) => {
    if (e) e.preventDefault()
    if (!newTitle.trim()) return

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const title = newTitle.trim()
      const slug = `${title.toLowerCase().replace(/[^a-z0-9]+/g, '-')}-${Math.random().toString(36).substring(7)}`

      const { data: book, error: bookError } = await supabase
        .from('books')
        .insert({
          title,
          slug,
          owner_id: user.id,
          settings: { published: false, unlisted: false },
          theme: { preset: 'ivory' },
        })
        .select()
        .single()

      if (bookError) throw bookError

      await supabase.from('pages').insert({
        id: crypto.randomUUID(),
        book_id: book.id,
        page_number: 1,
        type: 'content',
        layout: 'hero',
        blocks: [
          { id: crypto.randomUUID(), type: 'text', variant: 'title', content: title, align: 'center' },
        ],
        hotspots: [],
      })

      router.push(`/editor/${book.id}`)
    } catch (err: any) {
      if (guardLimit(err)) return
      toast.error(err.message || 'Failed to create folio')
      setLoading(false)
    }
  }

  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const title = 'Image Collection'
      const slug = `collection-${Math.random().toString(36).substring(7)}`

      const { data: book, error: bookError } = await supabase
        .from('books')
        .insert({
          title,
          slug,
          owner_id: user.id,
          settings: { published: false, unlisted: false },
          theme: { preset: 'ivory' },
        })
        .select()
        .single()

      if (bookError) throw bookError

      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext = file.name.split('.').pop()
        const path = `${user.id}/${book.id}/page-${i + 1}-${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage.from('folio-assets').upload(path, file)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('folio-assets').getPublicUrl(path)

        await supabase.from('pages').insert({
          book_id: book.id,
          page_number: i + 1,
          type: 'content',
          layout: 'image',
          background: publicUrl,
          blocks: [],
          hotspots: [],
        })
      }

      router.push(`/editor/${book.id}`)
    } catch (err: any) {
      if (guardLimit(err)) return
      toast.error(err.message || 'Failed to upload images')
      setLoading(false)
    }
  }

  if (step === 'pdf') {
    return <ImportPDFModal onClose={onClose} />
  }

  const shell = (children: React.ReactNode, maxW = 'max-w-xl') => (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-[#1d1d1f]/55 p-4 backdrop-blur-sm">
      <div className={`w-full ${maxW} overflow-hidden rounded-[2rem] border border-[var(--folio-border)] bg-[#ffffff] shadow-[0_40px_120px_rgba(27,23,18,0.35)]`}>
        {children}
      </div>
    </div>
  )

  // Upgrade wall — shown when the user is at their plan's book limit.
  if (limitHit) {
    return shell(
      <div className="p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--folio-ink)] text-[#ffffff]">
          <Crown size={26} />
        </div>
        <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-[var(--folio-ink)]">
          You've reached your book limit
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--folio-muted)]">
          {quota?.planName ? `Your ${quota.planName} plan` : 'Your plan'} includes{' '}
          {quota?.limit ?? 'a limited number of'} book{quota?.limit === 1 ? '' : 's'}. Upgrade to
          publish more interactive folios.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/#pricing"
            className="rounded-full bg-[var(--folio-teal)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:-translate-y-0.5 hover:bg-[#0a5be0]"
          >
            See plans
          </Link>
          <Link
            href="/redeem"
            className="rounded-full border border-[var(--folio-border)] bg-white/60 px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--folio-ink)] transition hover:-translate-y-0.5 hover:bg-white"
          >
            Redeem a code
          </Link>
        </div>
        <button onClick={onClose} className="mt-5 text-sm font-bold text-[var(--folio-muted)] hover:text-[var(--folio-ink)]">
          Close
        </button>
      </div>,
      'max-w-md'
    )
  }

  if (step === 'name-blank') {
    return shell(
      <>
        <div className="flex items-center justify-between border-b border-[var(--folio-border)] p-6">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--folio-ink)]">Name your KLICKO</h2>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--folio-muted)] transition-colors hover:bg-black/5">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCreateBlank} className="p-8">
          <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.14em] text-[var(--folio-muted)]">
            Book title
          </label>
          <input
            autoFocus
            required
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Q3 Investor Update"
            className="w-full rounded-[1.1rem] border border-[var(--folio-border)] bg-white/70 px-4 py-3 text-sm outline-none transition focus:border-[var(--folio-teal)] focus:ring-2 focus:ring-[var(--folio-teal)]/20"
          />

          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={() => setStep('choice')}
              className="flex-1 rounded-full border border-[var(--folio-border)] bg-white/60 px-4 py-3 text-sm font-bold text-[var(--folio-ink)] transition hover:bg-white"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading || !newTitle.trim()}
              className="flex-[2] rounded-full bg-[var(--folio-teal)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[#0a5be0] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create KLICKO'}
            </button>
          </div>
        </form>
      </>,
      'max-w-md'
    )
  }

  return shell(
    <>
      <div className="flex items-center justify-between border-b border-[var(--folio-border)] p-6">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--folio-ink)]">Create New KLICKO</h2>
          {quota && (
            <p className="mt-1 text-xs font-semibold text-[var(--folio-muted)]">
              {quota.used} / {quota.limit ?? '∞'} books used · {quota.planName}
            </p>
          )}
        </div>
        <button onClick={onClose} className="rounded-full p-2 text-[var(--folio-muted)] transition-colors hover:bg-black/5">
          <X size={20} />
        </button>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 gap-5 md:grid-cols-3">
          {[
            { key: 'blank', icon: Layout, title: 'Blank', desc: 'Start from scratch', onClick: () => setStep('name-blank') },
            { key: 'pdf', icon: FileText, title: 'PDF', desc: 'Convert document', onClick: () => setStep('pdf') },
            { key: 'images', icon: ImageIcon, title: 'Images', desc: 'Bulk upload', onClick: () => fileInputRef.current?.click() },
          ].map(({ key, icon: Icon, title, desc, onClick }) => (
            <button
              key={key}
              disabled={loading}
              onClick={onClick}
              className="group flex flex-col items-center gap-4 rounded-[1.5rem] border border-[var(--folio-border)] bg-white/55 p-6 text-center transition-all hover:-translate-y-1 hover:border-[var(--folio-teal)] hover:bg-white disabled:opacity-50"
            >
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--folio-ink)] text-[#f5f5f7] transition-colors group-hover:bg-[var(--folio-teal)]">
                <Icon size={26} />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold tracking-[-0.03em] text-[var(--folio-ink)]">{title}</h3>
                <p className="mt-1 text-xs text-[var(--folio-muted)]">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleBulkImageUpload} className="hidden" />

        {loading && (
          <div className="mt-8 flex animate-pulse items-center justify-center gap-3 text-sm font-semibold text-[var(--folio-teal)]">
            <Loader2 className="animate-spin" size={18} />
            Initializing your folio…
          </div>
        )}
      </div>

      <div className="flex items-center justify-center border-t border-[var(--folio-border)] bg-white/40 p-5 text-xs text-[var(--folio-muted)]">
        Tip: PDFs are best for books, Images are best for portfolios.
      </div>
    </>
  )
}
