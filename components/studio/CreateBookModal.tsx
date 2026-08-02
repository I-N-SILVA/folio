'use client'

import { useState, useRef, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, FileText, Layout, Image as ImageIcon, Loader2, Crown } from 'lucide-react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
const ImportPDFModal = dynamic(() => import('./ImportPDFModal').then(m => m.ImportPDFModal), { ssr: false })
import { createBrowserSupabase } from '@/lib/supabase'
import { Modal } from '@/components/ui/Modal'
import { MAX_ASSET_BYTES, humanBytes, isAllowedAssetType } from '@/lib/uploads'

interface Props {
  onClose: () => void
}

type Quota = { used: number; limit: number | null; allowed: boolean; planName: string }

function isLimitError(message: string) {
  return /BOOK_LIMIT_REACHED|plan_limit|plan's limit/i.test(message)
}

function slugifyTitle(title: string) {
  return title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'edition'
}

/** `Math.random().toString(36).substring(7)` can come back empty. */
function randomSuffix() {
  return Math.random().toString(36).slice(2, 8).padEnd(6, '0')
}

export function CreateBookModal({ onClose }: Props) {
  const [step, setStep] = useState<'choice' | 'pdf' | 'images' | 'name-blank'>('choice')
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [limitHit, setLimitHit] = useState(false)
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null)
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [slugError, setSlugError] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createBrowserSupabase()

  // The slug is the public URL and nothing in the app can change it later, so
  // it has to be settable here. Derived from the title until the user takes
  // it over — no random suffix, so the shared link reads as something a person
  // wrote; a collision comes back from the server as a 409 to correct.
  const effectiveSlug = slugifyTitle(slugEdited ? slug : newTitle.trim())

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
    const title = newTitle.trim()
    if (!title) return

    setLoading(true)
    setSlugError('')
    try {
      // Goes through the API rather than inserting from the browser, so the
      // Zod schema, the plan-quota check with its friendly message, and slug
      // conflict handling all apply to this path too. The direct-insert
      // version drifted from the API's rules and shipped bugs the API's
      // validation would have caught.
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, slug: effectiveSlug }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        if (payload.code === 'plan_limit') {
          setLimitHit(true)
          setLoading(false)
          return
        }
        if (res.status === 409) {
          setSlugError('That URL is already taken — try another.')
          setLoading(false)
          return
        }
        throw new Error(
          typeof payload.error === 'string' ? payload.error : 'Failed to create edition'
        )
      }

      const book = await res.json()
      router.push(`/editor/${book.id}`)
    } catch (err: any) {
      if (guardLimit(err)) return
      toast.error(err.message || 'Failed to create edition')
      setLoading(false)
    }
  }

  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    // Let the same files be re-picked after a failed run.
    e.target.value = ''
    if (files.length === 0) return

    // Validate before creating anything. A rejected file used to surface only
    // after the book already existed and images had been uploaded.
    const tooLarge = files.find((f) => f.size > MAX_ASSET_BYTES)
    if (tooLarge) {
      toast.error(
        `${tooLarge.name} is ${humanBytes(tooLarge.size)} — the limit is ${humanBytes(MAX_ASSET_BYTES)}.`
      )
      return
    }
    const badType = files.find((f) => !isAllowedAssetType(f.type))
    if (badType) {
      toast.error(`${badType.name} isn't a supported image type.`)
      return
    }

    setLoading(true)
    setProgress({ done: 0, total: files.length })

    let createdBookId: string | null = null
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const title = newTitle.trim() || 'Image Collection'
      const slug = `${slugifyTitle(title)}-${randomSuffix()}`

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
      createdBookId = book.id

      const pages: Record<string, unknown>[] = []
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext = file.name.split('.').pop()
        const path = `${user.id}/${book.id}/page-${i + 1}-${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage.from('folio-assets').upload(path, file)
        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage.from('folio-assets').getPublicUrl(path)

        pages.push({
          book_id: book.id,
          page_number: i + 1,
          type: 'content',
          // 'image' is not a member of the layout enum — the DB CHECK
          // constraint rejected it, so this path failed on its first page
          // insert and left behind an orphan book. A full-bleed background
          // image needs no block layout, so 'blank' is the right fit.
          layout: 'blank',
          // `background` is a jsonb object, not a URL string. Assigning the
          // bare URL meant `page.background?.image` was always undefined, so
          // even a page that survived would have rendered empty.
          background: { image: publicUrl },
          blocks: [],
          hotspots: [],
        })

        setProgress({ done: i + 1, total: files.length })
      }

      const { error: pagesError } = await supabase.from('pages').insert(pages)
      if (pagesError) throw pagesError

      router.push(`/editor/${book.id}`)
    } catch (err: any) {
      // Don't strand an empty book against the user's plan quota — on the
      // free tier a single orphan blocks every future creation.
      if (createdBookId) {
        await supabase.from('books').delete().eq('id', createdBookId)
      }
      setProgress(null)
      if (guardLimit(err)) return
      toast.error(err.message || 'Failed to upload images')
      setLoading(false)
    }
  }

  if (step === 'pdf') {
    return <ImportPDFModal onClose={onClose} />
  }

  const shell = (children: React.ReactNode, title = 'Create a new edition', maxW = 'max-w-xl') => (
    <Modal
      onClose={loading ? () => {} : onClose}
      title={title}
      hideCloseButton
      dismissOnBackdrop={!loading}
      className={`${maxW} overflow-hidden rounded-[2rem] border border-[var(--qlico-border)] shadow-[0_40px_120px_rgba(27,23,18,0.35)]`}
    >
      {children}
    </Modal>
  )

  // Upgrade wall — shown when the user is at their plan's book limit.
  if (limitHit) {
    return shell(
      <div className="p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--qlico-ink)] text-[#ffffff]">
          <Crown size={26} />
        </div>
        <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-[var(--qlico-ink)]">
          You've reached your book limit
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--qlico-muted)]">
          {quota?.planName ? `Your ${quota.planName} plan` : 'Your plan'} includes{' '}
          {quota?.limit ?? 'a limited number of'} book{quota?.limit === 1 ? '' : 's'}. Upgrade to
          publish more interactive editions.
        </p>
        <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/#pricing"
            className="rounded-full bg-[var(--qlico-teal)] px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-hover)]"
          >
            See plans
          </Link>
          <Link
            href="/redeem"
            className="rounded-full border border-[var(--qlico-border)] bg-white/60 px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--qlico-ink)] transition hover:-translate-y-0.5 hover:bg-white"
          >
            Redeem a code
          </Link>
        </div>
        <button onClick={onClose} className="mt-5 text-sm font-bold text-[var(--qlico-muted)] hover:text-[var(--qlico-ink)]">
          Close
        </button>
      </div>,
      'Book limit reached',
      'max-w-md'
    )
  }

  if (step === 'name-blank') {
    return shell(
      <>
        <div className="flex items-center justify-between border-b border-[var(--qlico-border)] p-6">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--qlico-ink)]">Name your QLICO</h2>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--qlico-muted)] transition-colors hover:bg-black/5">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCreateBlank} className="p-8">
          <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.14em] text-[var(--qlico-muted)]">
            Book title
          </label>
          <input
            autoFocus
            required
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Q3 Investor Update"
            className="w-full rounded-[1.1rem] border border-[var(--qlico-border)] bg-white/70 px-4 py-3 text-sm outline-none transition focus:border-[var(--qlico-teal)] focus:ring-2 focus:ring-[var(--qlico-teal)]/20"
          />

          {/* This is the permanent public URL — nothing downstream can change
              it, so it can't be a silent auto-generated string. */}
          <label
            htmlFor="new-book-slug"
            className="mb-2 mt-5 block text-sm font-semibold uppercase tracking-[0.14em] text-[var(--qlico-muted)]"
          >
            Public link
          </label>
          <div
            className={`flex items-center overflow-hidden rounded-[1.1rem] border bg-white/70 focus-within:ring-2 focus-within:ring-[var(--qlico-teal)]/20 ${
              slugError ? 'border-red-400' : 'border-[var(--qlico-border)] focus-within:border-[var(--qlico-teal)]'
            }`}
          >
            <span className="border-r border-[var(--qlico-border)] bg-black/[0.03] px-3 py-3 text-sm text-[var(--qlico-muted)]">
              /book/
            </span>
            <input
              id="new-book-slug"
              value={effectiveSlug}
              onChange={(e) => {
                setSlugEdited(true)
                setSlug(e.target.value)
                setSlugError('')
              }}
              placeholder="q3-investor-update"
              aria-invalid={Boolean(slugError)}
              aria-describedby={slugError ? 'new-book-slug-error' : undefined}
              className="flex-1 bg-transparent px-3 py-3 text-sm outline-none"
            />
          </div>
          {slugError && (
            <p id="new-book-slug-error" role="alert" className="mt-2 text-sm text-red-600">
              {slugError}
            </p>
          )}

          <div className="flex gap-3 pt-6">
            <button
              type="button"
              onClick={() => setStep('choice')}
              className="flex-1 rounded-full border border-[var(--qlico-border)] bg-white/60 px-4 py-3 text-sm font-bold text-[var(--qlico-ink)] transition hover:bg-white"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading || !newTitle.trim() || !effectiveSlug}
              className="flex-[2] rounded-full bg-[var(--qlico-teal)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create QLICO'}
            </button>
          </div>
        </form>
      </>,
      'Name your edition',
      'max-w-md'
    )
  }

  return shell(
    <>
      <div className="flex items-center justify-between border-b border-[var(--qlico-border)] p-6">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--qlico-ink)]">Create New QLICO</h2>
          {quota && (
            <p className="mt-1 text-xs font-semibold text-[var(--qlico-muted)]">
              {quota.used} / {quota.limit ?? '∞'} books used · {quota.planName}
            </p>
          )}
        </div>
        <button onClick={onClose} className="rounded-full p-2 text-[var(--qlico-muted)] transition-colors hover:bg-black/5">
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
              className="group flex flex-col items-center gap-4 rounded-[1.5rem] border border-[var(--qlico-border)] bg-white/55 p-6 text-center transition-all hover:-translate-y-1 hover:border-[var(--qlico-teal)] hover:bg-white disabled:opacity-50"
            >
              <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--qlico-ink)] text-[#f5f5f7] transition-colors group-hover:bg-[var(--qlico-teal)]">
                <Icon size={26} />
              </div>
              <div>
                <h3 className="font-display text-lg font-semibold tracking-[-0.03em] text-[var(--qlico-ink)]">{title}</h3>
                <p className="mt-1 text-xs text-[var(--qlico-muted)]">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        <input type="file" multiple accept="image/*" ref={fileInputRef} onChange={handleBulkImageUpload} className="hidden" />

        {loading && (
          <div className="mt-8">
            <div className="flex items-center justify-center gap-3 text-sm font-semibold text-[var(--qlico-teal)]">
              <Loader2 className="animate-spin" size={18} />
              {progress
                ? `Uploading image ${progress.done} of ${progress.total}…`
                : 'Initializing your edition…'}
            </div>
            {/* A 40-image upload used to be an unbroken, unexplained wait. */}
            {progress && (
              <div
                role="progressbar"
                aria-valuenow={progress.done}
                aria-valuemin={0}
                aria-valuemax={progress.total}
                aria-label="Upload progress"
                className="mx-auto mt-3 h-1.5 w-full max-w-xs overflow-hidden rounded-full bg-black/8"
              >
                <div
                  className="h-full rounded-full bg-[var(--accent)] transition-[width] duration-300"
                  style={{ width: `${Math.round((progress.done / progress.total) * 100)}%` }}
                />
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex items-center justify-center border-t border-[var(--qlico-border)] bg-white/40 p-5 text-xs text-[var(--qlico-muted)]">
        Tip: PDFs are best for books, Images are best for portfolios.
      </div>
    </>
  )
}
