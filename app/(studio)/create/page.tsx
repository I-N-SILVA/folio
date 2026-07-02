'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { Crown } from 'lucide-react'
import { THEME_PRESETS } from '@/lib/book-schema'

type Step = 1 | 2 | 3

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
}

const inputCls =
  'w-full rounded-[1.1rem] border border-[var(--folio-border)] bg-white/70 px-4 py-3 text-sm outline-none transition focus:border-[var(--folio-teal)] focus:ring-2 focus:ring-[var(--folio-teal)]/20'
const primaryBtn =
  'rounded-full bg-[var(--folio-teal)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white shadow-lg transition hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] disabled:cursor-not-allowed disabled:opacity-50'
const ghostBtn =
  'rounded-full border border-[var(--folio-border)] bg-white/60 px-5 py-3 text-sm font-bold text-[var(--folio-ink)] transition hover:bg-white'

export default function CreatePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [theme, setTheme] = useState<keyof typeof THEME_PRESETS>('ivory')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [limitHit, setLimitHit] = useState(false)

  function handleTitleChange(val: string) {
    setTitle(val)
    if (!slugEdited) setSlug(slugify(val))
  }

  async function handleCreate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, slug, theme: { preset: theme } }),
      })
      if (!res.ok) {
        const data = await res.json()
        if (data.code === 'plan_limit') {
          setLimitHit(true)
          setLoading(false)
          return
        }
        setError(typeof data.error === 'string' ? data.error : 'Something went wrong')
        setLoading(false)
        return
      }
      const book = await res.json()
      router.push(`/editor/${book.id}`)
    } catch {
      setError('Network error')
      setLoading(false)
    }
  }

  return (
    <main className="folio-grain flex min-h-screen items-center justify-center bg-[var(--background)] p-6 text-[var(--folio-ink)]">
      <motion.div
        initial={{ opacity: 0, y: 20, filter: 'blur(6px)' }}
        animate={{ opacity: 1, y: 0, filter: 'blur(0px)' }}
        transition={{ type: 'spring', stiffness: 120, damping: 20 }}
        className="w-full max-w-lg rounded-[2.25rem] border border-[var(--folio-border)] bg-[#ffffff]/85 p-8 shadow-[var(--folio-shadow)] backdrop-blur"
      >
        {limitHit ? (
          <div className="text-center">
            <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--folio-ink)] text-[#ffffff]">
              <Crown size={26} />
            </div>
            <h2 className="font-display text-3xl font-semibold tracking-[-0.04em]">You've reached your book limit</h2>
            <p className="mx-auto mt-3 max-w-sm text-sm leading-6 text-[var(--folio-muted)]">
              Upgrade your plan to publish more interactive folios, or redeem a lifetime-deal code.
            </p>
            <div className="mt-7 flex flex-col gap-3 sm:flex-row sm:justify-center">
              <Link href="/#pricing" className={primaryBtn}>See plans</Link>
              <Link href="/redeem" className={ghostBtn}>Redeem a code</Link>
            </div>
            <Link href="/dashboard" className="mt-5 inline-block text-sm font-bold text-[var(--folio-muted)] hover:text-[var(--folio-ink)]">
              Back to studio
            </Link>
          </div>
        ) : (
          <>
            <div className="mb-8 flex gap-2">
              {([1, 2, 3] as const).map((s) => (
                <div
                  key={s}
                  className={`h-1.5 flex-1 rounded-full transition-colors ${s <= step ? 'bg-[var(--folio-teal)]' : 'bg-black/8'}`}
                />
              ))}
            </div>

            {step === 1 && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">Book details</h2>
                  <p className="mt-1 text-sm text-[var(--folio-muted)]">Give your book a title and a URL slug.</p>
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold uppercase tracking-[0.12em] text-[var(--folio-muted)]">Title *</label>
                  <input type="text" value={title} onChange={(e) => handleTitleChange(e.target.value)} placeholder="My Interactive Book" className={inputCls} />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold uppercase tracking-[0.12em] text-[var(--folio-muted)]">Description</label>
                  <textarea value={description} onChange={(e) => setDescription(e.target.value)} placeholder="What's this book about?" rows={3} className={`${inputCls} resize-none`} />
                </div>

                <div>
                  <label className="mb-1.5 block text-sm font-semibold uppercase tracking-[0.12em] text-[var(--folio-muted)]">URL slug *</label>
                  <div className="flex items-center overflow-hidden rounded-[1.1rem] border border-[var(--folio-border)] bg-white/70 focus-within:border-[var(--folio-teal)] focus-within:ring-2 focus-within:ring-[var(--folio-teal)]/20">
                    <span className="border-r border-[var(--folio-border)] bg-black/[0.03] px-3 py-3 text-sm text-[var(--folio-muted)]">/book/</span>
                    <input type="text" value={slug} onChange={(e) => { setSlug(e.target.value); setSlugEdited(true) }} placeholder="my-book" className="flex-1 bg-transparent px-3 py-3 text-sm outline-none" />
                  </div>
                </div>

                <button onClick={() => setStep(2)} disabled={!title || !slug} className={primaryBtn}>
                  Next: Choose Theme →
                </button>
              </div>
            )}

            {step === 2 && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">Pick a theme</h2>
                  <p className="mt-1 text-sm text-[var(--folio-muted)]">Sets your book's colors and typography.</p>
                </div>

                <div className="grid grid-cols-1 gap-3">
                  {(Object.entries(THEME_PRESETS) as [keyof typeof THEME_PRESETS, typeof THEME_PRESETS[keyof typeof THEME_PRESETS]][]).map(([key, preset]) => (
                    <button
                      key={key}
                      onClick={() => setTheme(key)}
                      className={`flex items-center gap-4 rounded-[1.25rem] border-2 p-4 text-left transition-all ${
                        theme === key ? 'border-[var(--folio-teal)] bg-white/70' : 'border-[var(--folio-border)] hover:border-[var(--folio-muted)]/40'
                      }`}
                    >
                      <div className="h-10 w-10 flex-shrink-0 rounded-lg" style={{ backgroundColor: preset.background, border: '1px solid rgba(0,0,0,0.1)' }} />
                      <div>
                        <p className="text-sm font-bold">{preset.label}</p>
                        <p className="text-xs text-[var(--folio-muted)]">{preset.headingFont} · {preset.bodyFont}</p>
                      </div>
                      <div className="ml-auto h-4 w-4 flex-shrink-0 rounded-full" style={{ backgroundColor: preset.primary }} />
                    </button>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className={`flex-1 ${ghostBtn}`}>← Back</button>
                  <button onClick={() => setStep(3)} className={`flex-1 ${primaryBtn}`}>Next: Review →</button>
                </div>
              </div>
            )}

            {step === 3 && (
              <div className="flex flex-col gap-5">
                <div>
                  <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">Ready to create</h2>
                  <p className="mt-1 text-sm text-[var(--folio-muted)]">Review your settings before creating.</p>
                </div>

                <div className="space-y-2 rounded-[1.25rem] border border-[var(--folio-border)] bg-white/55 p-4 text-sm">
                  <div className="flex justify-between"><span className="text-[var(--folio-muted)]">Title</span><span className="font-semibold">{title}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--folio-muted)]">Slug</span><span className="rounded bg-black/[0.06] px-2 py-0.5 font-mono text-xs">/book/{slug}</span></div>
                  <div className="flex justify-between"><span className="text-[var(--folio-muted)]">Theme</span><span className="font-semibold">{THEME_PRESETS[theme].label}</span></div>
                </div>

                {error && <p className="text-sm font-semibold text-red-600">{error}</p>}

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className={`flex-1 ${ghostBtn}`}>← Back</button>
                  <button onClick={handleCreate} disabled={loading} className={`flex-1 ${primaryBtn}`}>
                    {loading ? 'Creating…' : 'Create Book'}
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </motion.div>
    </main>
  )
}
