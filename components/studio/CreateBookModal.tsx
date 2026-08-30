'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { X, FileText, Layout, Loader2, Crown, Sparkles, ArrowRight } from 'lucide-react'
import { toast } from 'sonner'
import dynamic from 'next/dynamic'
const ImportPDFModal = dynamic(() => import('./ImportPDFModal').then(m => m.ImportPDFModal), { ssr: false })
import { Modal } from '@/components/ui/Modal'
import { trackProduct } from '@/lib/product-analytics'
import { TEMPLATES, type PublicationTemplate } from '@/data/templates'

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
  const [step, setStep] = useState<'choice' | 'pdf' | 'name-blank' | 'templates'>('choice')
  const [newTitle, setNewTitle] = useState('')
  const [loading, setLoading] = useState(false)
  const [quota, setQuota] = useState<Quota | null>(null)
  const [limitHit, setLimitHit] = useState(false)
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [slugError, setSlugError] = useState('')
  const router = useRouter()

  // The slug is the public URL and nothing in the app can change it later, so
  // it has to be settable here. Derived from the title until the user takes
  // it over — no random suffix, so the shared link reads as something a person
  // wrote; a collision comes back from the server as a 409 to correct.
  const effectiveSlug = slugifyTitle(slugEdited ? slug : newTitle.trim())

  useEffect(() => {
    trackProduct('edition_create_started')
  }, [])

  // The edition cap is still the only place in the product that asks for money,
  // so how often it is reached — and on which plan — is the whole monetisation
  // funnel's top of pipe. Fired from an effect rather than at the top of the
  // wall's render, which would emit again on every re-render behind it.
  useEffect(() => {
    if (!limitHit) return
    trackProduct('upgrade_viewed', {
      trigger: 'edition_limit',
      plan: quota?.planName ?? 'unknown',
    })
  }, [limitHit, quota?.planName])

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

  const handleSelectTemplate = async (tmpl: PublicationTemplate) => {
    setLoading(true)
    try {
      const initialSlug = `${tmpl.id}-${randomSuffix()}`
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: tmpl.title, slug: initialSlug }),
      })

      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        if (payload.code === 'plan_limit') {
          setLimitHit(true)
          setLoading(false)
          return
        }
        throw new Error(payload.error || 'Failed to create template edition')
      }

      const created = await res.json()
      const templateData = tmpl.generateBook(created.id, created.owner_id || '', created.slug)

      // Save initial template pages & theme
      await fetch(`/api/books/${created.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pages: templateData.pages,
          theme: templateData.theme,
          description: templateData.description,
        }),
      })

      toast.success(`Created "${tmpl.title}" template!`)
      router.push(`/editor/${created.id}`)
    } catch (err: any) {
      if (guardLimit(err)) return
      toast.error(err.message || 'Failed to create template')
      setLoading(false)
    }
  }

  if (step === 'pdf') {
    return (
      <ImportPDFModal
        onClose={onClose}
        onLimitReached={() => {
          setStep('choice')
          setLimitHit(true)
        }}
      />
    )
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

  // Upgrade wall — shown when the user is at their plan's edition limit.
  if (limitHit) {
    return shell(
      <div className="p-8 text-center">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--invert-surface)] text-[var(--invert-text)]">
          <Crown size={26} />
        </div>
        <h2 className="font-display text-3xl font-semibold tracking-[-0.04em] text-[var(--qlico-ink)]">
          You&apos;ve reached your edition limit
        </h2>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--qlico-muted)]">
          {quota?.planName ? `Your ${quota.planName} plan` : 'Your plan'} includes{' '}
          {quota?.limit ?? 'a limited number of'} edition{quota?.limit === 1 ? '' : 's'}. Delete one
          you no longer need, or move up a plan.
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
            className="rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/60 px-6 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[var(--qlico-ink)] transition hover:-translate-y-0.5 hover:bg-[var(--qlico-paper)]"
          >
            Redeem a code
          </Link>
        </div>
        <button onClick={onClose} className="mt-5 text-sm font-bold text-[var(--qlico-muted)] hover:text-[var(--qlico-ink)]">
          Close
        </button>
      </div>,
      'Edition limit reached',
      'max-w-md'
    )
  }

  if (step === 'name-blank') {
    return shell(
      <>
        <div className="flex items-center justify-between border-b border-[var(--qlico-border)] p-6">
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--qlico-ink)]">Name your edition</h2>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--qlico-muted)] transition-colors hover:bg-[var(--tint-weak)]">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleCreateBlank} className="p-8">
          <label className="mb-2 block text-sm font-semibold uppercase tracking-[0.14em] text-[var(--qlico-muted)]">
            Edition title
          </label>
          <input
            autoFocus
            required
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            placeholder="e.g. Q3 Investor Update"
            className="w-full rounded-[1.1rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/70 px-4 py-3 text-sm outline-none transition focus:border-[var(--qlico-teal)] focus:ring-2 focus:ring-[var(--qlico-teal)]/20"
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
            className={`flex items-center overflow-hidden rounded-[1.1rem] border bg-[var(--qlico-paper)]/70 focus-within:ring-2 focus-within:ring-[var(--qlico-teal)]/20 ${
              slugError ? 'border-red-400' : 'border-[var(--qlico-border)] focus-within:border-[var(--qlico-teal)]'
            }`}
          >
            <span className="border-r border-[var(--qlico-border)] bg-[var(--tint-weak)] px-3 py-3 text-sm text-[var(--qlico-muted)]">
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
              className="flex-1 rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/60 px-4 py-3 text-sm font-bold text-[var(--qlico-ink)] transition hover:bg-[var(--qlico-paper)]"
            >
              Back
            </button>
            <button
              type="submit"
              disabled={loading || !newTitle.trim() || !effectiveSlug}
              className="flex-[2] rounded-full bg-[var(--qlico-teal)] px-4 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50"
            >
              {loading ? 'Creating…' : 'Create edition'}
            </button>
          </div>
        </form>
      </>,
      'Name your edition',
      'max-w-md'
    )
  }

  const [selectedCategory, setSelectedCategory] = useState<string>('All')
  const [previewingTemplate, setPreviewingTemplate] = useState<PublicationTemplate | null>(null)
  const [previewPageIndex, setPreviewPageIndex] = useState<number>(0)

  if (step === 'templates') {
    const categories = ['All', ...Array.from(new Set(TEMPLATES.map((t) => t.category)))]
    const filteredTemplates =
      selectedCategory === 'All'
        ? TEMPLATES
        : TEMPLATES.filter((t) => t.category === selectedCategory)

    return shell(
      <>
        <div className="flex items-center justify-between border-b border-[var(--qlico-border)] p-6">
          <div>
            <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--qlico-ink)]">
              Choose a starter template
            </h2>
            <p className="mt-1 text-xs text-[var(--qlico-muted)]">
              Curated editorial designs with bespoke typography, layouts, and interactive hotspots.
            </p>
          </div>
          <button onClick={onClose} className="rounded-full p-2 text-[var(--qlico-muted)] transition-colors hover:bg-[var(--tint-weak)]">
            <X size={20} />
          </button>
        </div>

        {/* Category Filters */}
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar border-b border-[var(--qlico-border)]/60 px-6 py-3 bg-[var(--qlico-subtle)]/40">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-[var(--qlico-ink)] text-[var(--qlico-paper)]'
                  : 'bg-[var(--qlico-paper)]/70 text-[var(--qlico-muted)] hover:text-[var(--qlico-ink)] border border-[var(--qlico-border)]'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        <div className="p-6 max-h-[65vh] overflow-y-auto">
          <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
            {filteredTemplates.map((tmpl) => (
              <div
                key={tmpl.id}
                className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/80 transition hover:border-[var(--accent)] hover:shadow-lg"
              >
                {/* Visual Mockup Spread Header */}
                <div
                  className="relative h-36 w-full p-4 flex flex-col justify-between overflow-hidden border-b border-black/10 select-none"
                  style={{
                    backgroundColor: tmpl.previewMockup.bgHex,
                    color: tmpl.previewMockup.textHex,
                  }}
                >
                  <div className="flex items-center justify-between z-10">
                    <span
                      className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider"
                      style={{
                        backgroundColor: tmpl.previewMockup.accentHex + '22',
                        color: tmpl.previewMockup.accentHex,
                        border: `1px solid ${tmpl.previewMockup.accentHex}44`,
                      }}
                    >
                      {tmpl.previewMockup.tag}
                    </span>
                    <span className="text-[10px] font-mono opacity-60">
                      {tmpl.pagesCount} Spreads
                    </span>
                  </div>

                  <div className="z-10">
                    <h4 className="font-display text-xl font-bold tracking-tight leading-none mb-1">
                      {tmpl.previewMockup.headline}
                    </h4>
                    <p className="text-[11px] opacity-75 line-clamp-1">
                      {tmpl.previewMockup.subheadline}
                    </p>
                  </div>

                  {/* Wireframe Mini Blocks Decoration */}
                  <div className="absolute right-3 bottom-3 flex items-center gap-1.5 opacity-40">
                    <div className="h-6 w-10 rounded border border-current" />
                    <div className="h-6 w-6 rounded-full border border-current flex items-center justify-center text-[8px]">
                      ●
                    </div>
                  </div>

                  {/* Subtle Grain Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/30 to-transparent pointer-events-none" />
                </div>

                <div className="p-4 flex-1 flex flex-col justify-between">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <h3 className="font-display text-base font-semibold tracking-tight text-[var(--qlico-ink)]">
                        {tmpl.title}
                      </h3>
                    </div>
                    <p className="text-xs text-[var(--qlico-muted)] leading-relaxed mb-3">
                      {tmpl.subtitle}
                    </p>

                    {/* Feature Badges */}
                    <div className="flex flex-wrap gap-1 mb-4">
                      {tmpl.badges.map((b) => (
                        <span
                          key={b}
                          className="rounded-md bg-[var(--tint-weak)] px-2 py-0.5 text-[10px] font-medium text-[var(--qlico-muted)]"
                        >
                          {b}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="pt-3 border-t border-[var(--qlico-border)]/60 flex items-center justify-between gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setPreviewingTemplate(tmpl)
                        setPreviewPageIndex(0)
                      }}
                      className="flex items-center gap-1 rounded-full border border-[var(--qlico-border)] px-3 py-1.5 text-xs font-semibold text-[var(--qlico-ink)] hover:bg-[var(--tint-weak)] transition"
                    >
                      <Sparkles size={12} className="text-[var(--accent-fg)]" />
                      Preview Spread
                    </button>
                    <button
                      disabled={loading}
                      onClick={() => handleSelectTemplate(tmpl)}
                      className="flex items-center gap-1.5 rounded-full bg-[var(--qlico-teal)] px-4 py-1.5 text-xs font-semibold uppercase tracking-wider text-white shadow transition hover:opacity-90 disabled:opacity-50"
                    >
                      {loading ? 'Setting up…' : 'Use Template'}
                      <ArrowRight size={12} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="mt-6 flex justify-start">
            <button
              onClick={() => setStep('choice')}
              className="rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/60 px-4 py-2 text-xs font-bold text-[var(--qlico-ink)] transition hover:bg-[var(--qlico-paper)]"
            >
              ← Back to options
            </button>
          </div>
        </div>

        {/* Live Template Preview Modal */}
        {previewingTemplate && (
          <Modal
            onClose={() => setPreviewingTemplate(null)}
            title={previewingTemplate.title}
            className="max-w-xl w-full rounded-2xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)] p-6 text-[var(--qlico-ink)]"
          >
            <div className="flex items-center justify-between mb-4 border-b border-[var(--qlico-border)] pb-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--qlico-muted)]">
                  {previewingTemplate.category}
                </span>
                <h3 className="font-display text-lg font-semibold text-[var(--qlico-ink)]">
                  {previewingTemplate.title}
                </h3>
              </div>
              <button
                onClick={() => setPreviewingTemplate(null)}
                className="rounded-full p-1 text-[var(--qlico-muted)] hover:text-[var(--qlico-ink)]"
              >
                <X size={18} />
              </button>
            </div>

            {/* Template Mockup Display */}
            {(() => {
              const dummyBook = previewingTemplate.generateBook('preview-id', 'user', 'preview')
              const dummyPages = dummyBook.pages ?? []
              const activePage = dummyPages[previewPageIndex] ?? dummyPages[0]

              return (
                <div className="space-y-4">
                  {/* Page Indicator Tabs */}
                  <div className="flex items-center justify-center gap-2">
                    {dummyPages.map((p, idx) => (
                      <button
                        key={p.id}
                        onClick={() => setPreviewPageIndex(idx)}
                        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
                          previewPageIndex === idx
                            ? 'bg-[var(--qlico-ink)] text-[var(--qlico-paper)]'
                            : 'bg-[var(--tint-weak)] text-[var(--qlico-muted)] hover:text-[var(--qlico-ink)]'
                        }`}
                      >
                        Page {idx + 1} ({p.type})
                      </button>
                    ))}
                  </div>

                  {/* Rendered Preview Spread Container */}
                  <div
                    className="relative w-full rounded-xl overflow-hidden p-6 shadow-inner border border-[var(--qlico-border)] flex flex-col justify-between min-h-[260px]"
                    style={{
                      backgroundColor: activePage?.background?.color || dummyBook.theme?.background || '#09090b',
                      color: dummyBook.theme?.primary || '#ffffff',
                    }}
                  >
                    <div className="space-y-3">
                      {activePage?.blocks.map((block) => (
                        <div key={block.id} className="text-left">
                          {block.type === 'text' && (
                            <p
                              className={`${
                                block.variant === 'title'
                                  ? 'font-display text-2xl font-bold tracking-tight'
                                  : block.variant === 'heading'
                                    ? 'text-lg font-semibold'
                                    : block.variant === 'quote'
                                      ? 'italic border-l-2 border-current pl-3 opacity-90'
                                      : block.variant === 'stat'
                                        ? 'text-base font-bold opacity-90'
                                        : block.variant === 'caption'
                                          ? 'text-[10px] font-mono tracking-widest uppercase opacity-75'
                                          : 'text-xs opacity-80 leading-relaxed'
                              } ${block.align === 'center' ? 'text-center' : 'text-left'}`}
                            >
                              {block.content}
                            </p>
                          )}
                          {block.type === 'divider' && (
                            <hr className="my-2 border-current opacity-20" />
                          )}
                          {block.type === 'button' && (
                            <div className="pt-2">
                              <span className="inline-block rounded-full bg-white text-black px-4 py-1.5 text-xs font-bold shadow">
                                {block.label}
                              </span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>

                    {/* Hotspot Pins Preview */}
                    {activePage?.hotspots && activePage.hotspots.length > 0 && (
                      <div className="mt-4 pt-3 border-t border-white/10 flex items-center gap-2">
                        <span className="h-2.5 w-2.5 rounded-full bg-amber-400 animate-pulse" />
                        <span className="text-[11px] font-semibold text-amber-300">
                          {activePage.hotspots.length} Interactive Hotspot Pin: {activePage.hotspots[0]?.label}
                        </span>
                      </div>
                    )}
                  </div>

                  <div className="flex items-center justify-between pt-2">
                    <p className="text-xs text-[var(--qlico-muted)]">
                      Ready to customize with your own text, photos and links.
                    </p>
                    <button
                      disabled={loading}
                      onClick={() => handleSelectTemplate(previewingTemplate)}
                      className="flex items-center gap-2 rounded-full bg-[var(--qlico-teal)] px-5 py-2 text-xs font-bold uppercase tracking-wider text-white shadow-lg transition hover:scale-105"
                    >
                      {loading ? 'Creating…' : 'Use This Template'}
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              )
            })()}
          </Modal>
        )}
      </>,
      'Starter Templates',
      'max-w-3xl'
    )
  }

  return shell(
    <>
      <div className="flex items-center justify-between border-b border-[var(--qlico-border)] p-6">
        <div>
          <h2 className="font-display text-2xl font-semibold tracking-[-0.04em] text-[var(--qlico-ink)]">Create an edition</h2>
          {quota && (
            <p className="mt-1 text-xs font-semibold text-[var(--qlico-muted)]">
              {quota.used} / {quota.limit ?? '∞'} editions used · {quota.planName}
            </p>
          )}
        </div>
        <button onClick={onClose} className="rounded-full p-2 text-[var(--qlico-muted)] transition-colors hover:bg-[var(--tint-weak)]">
          <X size={20} />
        </button>
      </div>

      <div className="p-8">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          {[
            {
              key: 'pdf',
              icon: FileText,
              title: 'Import a PDF',
              desc: 'Every page becomes a spread you can add hotspots to.',
              onClick: () => setStep('pdf'),
              primary: true,
            },
            {
              key: 'templates',
              icon: Sparkles,
              title: 'From Template',
              desc: 'Curated lookbooks, portfolios, reports, and menus.',
              onClick: () => setStep('templates'),
              primary: false,
            },
            {
              key: 'blank',
              icon: Layout,
              title: 'Start Blank',
              desc: 'Build page by page with text, photos, video & data.',
              onClick: () => setStep('name-blank'),
              primary: false,
            },
          ].map(({ key, icon: Icon, title, desc, onClick, primary }) => (
            <button
              key={key}
              disabled={loading}
              onClick={onClick}
              className={`group flex flex-col items-start gap-3 rounded-[1.5rem] border p-5 text-left transition-all hover:-translate-y-1 disabled:opacity-50 ${
                primary
                  ? 'border-[var(--accent)]/40 bg-[var(--accent)]/5 hover:border-[var(--accent)]'
                  : 'border-[var(--qlico-border)] bg-[var(--qlico-paper)]/55 hover:border-[var(--qlico-ink)]'
              }`}
            >
              <div
                className={`grid h-10 w-10 place-items-center rounded-xl transition-colors ${
                  primary
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'bg-[var(--invert-surface)] text-[var(--invert-text)]'
                }`}
              >
                <Icon size={18} />
              </div>
              <div>
                <h3 className="font-display text-base font-semibold tracking-[-0.03em] text-[var(--qlico-ink)]">
                  {title}
                </h3>
                <p className="mt-1 text-xs leading-4 text-[var(--qlico-muted)]">{desc}</p>
              </div>
            </button>
          ))}
        </div>

        {loading && (
          <div className="mt-8 flex items-center justify-center gap-3 text-sm font-semibold text-[var(--accent-fg)]">
            <Loader2 className="animate-spin" size={18} />
            Setting up your edition…
          </div>
        )}
      </div>

      <div className="flex items-center justify-center border-t border-[var(--qlico-border)] bg-[var(--qlico-paper)]/40 p-5 text-xs text-[var(--qlico-muted)]">
        You can rename an edition later — its link is the one thing that&apos;s permanent.
      </div>
    </>
  )
}
