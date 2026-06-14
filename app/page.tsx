'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import { useState } from 'react'
import {
  BarChart2,
  BookOpen,
  ChevronDown,
  Code2,
  FileUp,
  Gift,
  MousePointerClick,
  Palette,
  Plus,
} from 'lucide-react'
import Reveal from '@/components/landing/Reveal'

const BrowserPreview = dynamic(() => import('@/components/landing/BrowserPreview'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#f5f5f7]" />,
})

const FEATURES = [
  { icon: BookOpen, title: 'Tactile reader', desc: 'A fluid page-turn that feels like a printed object — not a PDF viewer.' },
  { icon: MousePointerClick, title: 'Interactive hotspots', desc: 'Layer products, video, and links directly onto the page.' },
  { icon: BarChart2, title: 'Reader analytics', desc: 'Opens, dwell time, completion, and hotspot clicks — in your own data layer.' },
  { icon: FileUp, title: 'PDF to experience', desc: 'Import an existing PDF and publish an interactive edition in minutes.' },
  { icon: Code2, title: 'One-line embeds', desc: 'Drop a responsive edition into any site, store, or CMS.' },
  { icon: Palette, title: 'Made to match', desc: 'Themes, custom domains, and no watermark on paid plans.' },
]

const STEPS = [
  ['01', 'Compose', 'Start from a PDF or build page-by-page with modular blocks.'],
  ['02', 'Enrich', 'Add hotspots, lead gates, themes, and metadata.'],
  ['03', 'Publish', 'Share a hosted reader, embed it anywhere, measure everything.'],
]

const FAQS = [
  { q: 'Do readers need an account or app?', a: 'No. Every edition is a hosted link that opens instantly in any browser, and embeds anywhere with one line of code.' },
  { q: 'Can I import an existing PDF?', a: 'Yes. Drop in a PDF and Riffle turns each page into an interactive spread you can enrich with hotspots, links, and media.' },
  { q: 'Where does my analytics data live?', a: 'Reader intelligence — opens, dwell time, completion, hotspot clicks — is captured into your own Supabase project, so you own the data.' },
  { q: 'Is Riffle installable as an app?', a: 'Yes. Riffle is a progressive web app you can install on iOS and Android, and it works offline.' },
  { q: 'Can I use my own brand and domain?', a: 'Pro and lifetime plans let you ship on a custom domain with your own theme and no Riffle watermark.' },
]

const PLANS: {
  name: string
  price: string
  cadence?: string
  desc: string
  cta: string
  href: string
  featured?: boolean
  features: string[]
}[] = [
  {
    name: 'Free',
    price: '$0',
    desc: 'Publish your first interactive edition.',
    cta: 'Start free',
    href: '/login',
    features: ['1 publication', '7-day analytics', 'Riffle watermark'],
  },
  {
    name: 'Pro',
    price: '$19',
    cadence: '/mo',
    desc: 'For creators and teams who publish often.',
    cta: 'Get Pro',
    href: '/login?next=%2Faccount',
    featured: true,
    features: ['Unlimited publications', '90-day analytics', 'Custom domain', 'No watermark', 'CSV export'],
  },
  {
    name: 'Lifetime',
    price: '$199',
    desc: 'One payment. Yours forever.',
    cta: 'See the deal',
    href: '/redeem',
    features: ['Everything in Pro', 'Lifetime updates', 'PDF import', 'Priority support'],
  },
]

const TRUST = ['ATELIER NORD', 'FIELD NOTES', 'COHERE STUDIO', 'MERIDIAN PRESS', 'STUDIO KOA', 'VERANDA']

function Mark({ className = '' }: { className?: string }) {
  return (
    <span className={`grid place-items-center rounded-[0.6rem] bg-[var(--folio-ink)] font-semibold text-white ${className}`}>
      R
    </span>
  )
}

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[var(--folio-border)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-6 text-left"
      >
        <span className="text-lg font-medium tracking-[-0.01em]">{q}</span>
        <ChevronDown size={20} className={`shrink-0 text-[var(--folio-muted)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] pb-6 opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <p className="overflow-hidden text-[15px] leading-7 text-[var(--folio-muted)]">{a}</p>
      </div>
    </div>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[var(--background)] text-[var(--folio-ink)]">
      {/* Nav */}
      <header className="fixed inset-x-0 top-0 z-50 border-b border-[var(--folio-hairline)] bg-white/80 backdrop-blur-xl">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center gap-2" aria-label="Riffle home">
            <Mark className="h-7 w-7 text-sm" />
            <span className="text-lg font-semibold tracking-[-0.02em]">Riffle</span>
          </Link>
          <nav className="hidden items-center gap-8 text-[13px] font-medium text-[var(--folio-muted)] md:flex">
            <Link href="#features" className="transition hover:text-[var(--folio-ink)]">Features</Link>
            <Link href="#how" className="transition hover:text-[var(--folio-ink)]">How it works</Link>
            <Link href="#pricing" className="transition hover:text-[var(--folio-ink)]">Pricing</Link>
            <Link href="/book/demo" className="transition hover:text-[var(--folio-ink)]">Demo</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-full px-4 py-1.5 text-[13px] font-medium text-[var(--folio-ink)] transition hover:bg-black/5 sm:block">
              Sign in
            </Link>
            <Link href="/login" className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[var(--accent-hover)]">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-5 pb-16 pt-32 text-center sm:pt-40">
          {/* Ambient depth */}
          <div
            aria-hidden
            className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[680px]"
            style={{
              background:
                'radial-gradient(120% 70% at 50% -10%, rgba(0,102,255,0.07) 0%, rgba(0,102,255,0.02) 35%, transparent 70%)',
            }}
          />
          <div className="mx-auto max-w-3xl">
            <Reveal>
              <span className="inline-flex items-center gap-2 rounded-full border border-[var(--folio-border)] bg-white/70 px-3.5 py-1.5 text-[13px] font-medium text-[var(--folio-muted)] backdrop-blur">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
                Interactive publishing
              </span>
              <h1 className="mt-6 text-6xl font-semibold leading-[1.02] tracking-[-0.04em] sm:text-7xl lg:text-[5.5rem]">
                Flip through anything.
              </h1>
              <p className="mx-auto mt-6 max-w-xl text-xl leading-8 text-[var(--folio-muted)]">
                Riffle turns static PDFs into interactive editions — with hotspots, analytics, and
                one-line embeds. Built for catalogs, lookbooks, portfolios, and reports.
              </p>
              <div className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/login" className="w-full rounded-full bg-[var(--accent)] px-7 py-3.5 text-center text-[15px] font-semibold text-white transition hover:bg-[var(--accent-hover)] sm:w-auto">
                  Start for free
                </Link>
                <Link href="/book/demo" className="text-[15px] font-medium text-[var(--accent)] transition hover:underline">
                  View the demo →
                </Link>
              </div>
            </Reveal>
          </div>

          {/* Product shot */}
          <Reveal delay={120}>
            <div className="relative mx-auto mt-16 max-w-5xl">
              <div className="overflow-hidden rounded-[1.5rem] border border-[var(--folio-border)] bg-white shadow-[0_50px_140px_-30px_rgba(0,0,0,0.35)] ring-1 ring-black/[0.02]">
                <div className="flex items-center gap-1.5 border-b border-[var(--folio-hairline)] bg-[#fbfbfd] px-4 py-3">
                  <span className="h-3 w-3 rounded-full bg-[#e1e1e6]" />
                  <span className="h-3 w-3 rounded-full bg-[#e1e1e6]" />
                  <span className="h-3 w-3 rounded-full bg-[#e1e1e6]" />
                  <div className="mx-auto flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-left text-xs text-[var(--folio-muted)] shadow-sm">
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
                    riffle.app/book/demo
                  </div>
                </div>
                <div className="aspect-[16/10] bg-[#f5f5f7]">
                  <BrowserPreview />
                </div>
              </div>
              {/* Soft floor reflection */}
              <div
                aria-hidden
                className="pointer-events-none absolute -bottom-10 left-1/2 -z-10 h-24 w-[78%] -translate-x-1/2 rounded-[50%] bg-black/15 blur-3xl"
              />
            </div>
          </Reveal>
        </section>

        {/* Trust */}
        <section className="border-y border-[var(--folio-hairline)] bg-[var(--background-alt)] px-5 py-10">
          <div className="mx-auto max-w-5xl">
            <p className="mb-6 text-center text-xs font-semibold uppercase tracking-[0.18em] text-[var(--folio-muted)]">
              Trusted by publishing teams
            </p>
            <div className="flex flex-wrap items-center justify-center gap-x-10 gap-y-4">
              {TRUST.map((name) => (
                <span key={name} className="text-sm font-semibold tracking-[0.06em] text-[var(--folio-ink)]/35">
                  {name}
                </span>
              ))}
            </div>
          </div>
        </section>

        {/* Features */}
        <section id="features" className="px-5 py-28">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-16 max-w-2xl text-center">
              <h2 className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Everything a page can be.</h2>
              <p className="mt-4 text-lg leading-8 text-[var(--folio-muted)]">
                A studio, a reader, and the intelligence in between.
              </p>
            </Reveal>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, desc }, i) => (
                <Reveal key={title} delay={(i % 3) * 80}>
                  <div className="group h-full rounded-3xl border border-[var(--folio-border)] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--folio-subtle)] text-[var(--folio-ink)] transition-colors duration-300 group-hover:bg-[var(--folio-ink)] group-hover:text-white">
                      <Icon size={20} strokeWidth={1.75} />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold tracking-[-0.01em]">{title}</h3>
                    <p className="mt-2 text-[15px] leading-7 text-[var(--folio-muted)]">{desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Statement (dark) */}
        <section className="bg-[var(--folio-ink)] px-5 py-28 text-white">
          <div className="mx-auto max-w-4xl text-center">
            <Reveal>
              <h2 className="text-4xl font-semibold leading-[1.1] tracking-[-0.03em] sm:text-6xl">
                A download link is where good work goes to be forgotten.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/60">
                Riffle gives your publication a reason to be opened, explored, and finished — and
                shows you exactly what held attention.
              </p>
              <Link href="/login" className="mt-9 inline-block rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-[var(--folio-ink)] transition hover:bg-white/90">
                Create your first edition
              </Link>
            </Reveal>
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="px-5 py-28">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mb-16 max-w-2xl">
              <h2 className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">From flat file to living edition.</h2>
            </Reveal>
            <div className="grid gap-px overflow-hidden rounded-2xl border border-[var(--folio-border)] bg-[var(--folio-border)] sm:grid-cols-3">
              {STEPS.map(([num, title, desc]) => (
                <div key={num} className="bg-white p-8">
                  <span className="text-sm font-semibold text-[var(--accent)]">{num}</span>
                  <h3 className="mt-4 text-xl font-semibold tracking-[-0.01em]">{title}</h3>
                  <p className="mt-2 text-[15px] leading-7 text-[var(--folio-muted)]">{desc}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="bg-[var(--background-alt)] px-5 py-28">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mb-16 text-center">
              <h2 className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Simple, honest pricing.</h2>
              <p className="mt-4 text-lg text-[var(--folio-muted)]">Start free. Upgrade when it earns its keep.</p>
            </Reveal>
            <div className="grid items-stretch gap-5 lg:grid-cols-3">
              {PLANS.map(({ name, price, cadence, desc, cta, href, features, featured }) => (
                <div
                  key={name}
                  className={`flex flex-col rounded-3xl border p-8 ${
                    featured ? 'border-[var(--folio-ink)] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.1)]' : 'border-[var(--folio-border)] bg-white'
                  }`}
                >
                  {featured && (
                    <span className="mb-4 inline-block w-fit rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-white">
                      Most popular
                    </span>
                  )}
                  <h3 className="text-lg font-semibold">{name}</h3>
                  <div className="mt-3 flex items-end gap-1">
                    <span className="text-5xl font-semibold tracking-[-0.04em]">{price}</span>
                    {cadence && <span className="mb-1.5 text-sm text-[var(--folio-muted)]">{cadence}</span>}
                  </div>
                  <p className="mt-3 text-[15px] text-[var(--folio-muted)]">{desc}</p>
                  <ul className="mt-7 flex-1 space-y-3">
                    {features.map((f) => (
                      <li key={f} className="flex items-start gap-2.5 text-[15px]">
                        <Plus size={16} className="mt-1 shrink-0 text-[var(--accent)]" />
                        <span>{f}</span>
                      </li>
                    ))}
                  </ul>
                  <Link
                    href={href}
                    className={`mt-8 rounded-full px-5 py-3 text-center text-[15px] font-semibold transition ${
                      featured
                        ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                        : 'bg-[var(--folio-subtle)] text-[var(--folio-ink)] hover:bg-[#ececef]'
                    }`}
                  >
                    {cta}
                  </Link>
                </div>
              ))}
            </div>

            <Reveal className="mt-6">
              <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[var(--folio-border)] bg-white px-7 py-5 text-center sm:flex-row sm:text-left">
                <div className="flex items-center gap-3">
                  <Gift size={20} className="text-[var(--accent)]" />
                  <p className="text-[15px] font-medium">Got a lifetime deal code? Redeem it to unlock your tier.</p>
                </div>
                <Link href="/redeem" className="shrink-0 text-[15px] font-semibold text-[var(--accent)] hover:underline">
                  Redeem a code →
                </Link>
              </div>
            </Reveal>
          </div>
        </section>

        {/* FAQ */}
        <section id="faq" className="px-5 py-28">
          <div className="mx-auto max-w-3xl">
            <Reveal className="mb-12 text-center">
              <h2 className="text-4xl font-semibold tracking-[-0.03em] sm:text-5xl">Questions, answered.</h2>
            </Reveal>
            <div>
              {FAQS.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 pb-28">
          <div className="mx-auto max-w-4xl rounded-[2rem] bg-[var(--folio-ink)] px-8 py-20 text-center text-white">
            <Reveal>
              <h2 className="mx-auto max-w-2xl text-4xl font-semibold leading-[1.1] tracking-[-0.03em] sm:text-5xl">
                Your next publication deserves more.
              </h2>
              <p className="mx-auto mt-5 max-w-lg text-lg text-white/60">
                Build it once. Ship it on the web, embedded, and installed as an app.
              </p>
              <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
                <Link href="/login" className="w-full rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-[var(--folio-ink)] transition hover:bg-white/90 sm:w-auto">
                  Start for free
                </Link>
                <Link href="/book/demo" className="text-[15px] font-medium text-white/80 transition hover:text-white">
                  Explore the demo →
                </Link>
              </div>
            </Reveal>
          </div>
        </section>
      </main>

      {/* Footer */}
      <footer className="border-t border-[var(--folio-hairline)] px-5 py-12">
        <div className="mx-auto max-w-6xl">
          <div className="flex flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <div className="flex items-center gap-2">
                <Mark className="h-7 w-7 text-sm" />
                <span className="text-lg font-semibold tracking-[-0.02em]">Riffle</span>
              </div>
              <p className="mt-3 max-w-xs text-sm text-[var(--folio-muted)]">
                Interactive publishing — with craft, context, and control.
              </p>
            </div>
            <div className="grid grid-cols-2 gap-x-14 gap-y-2.5 text-sm sm:grid-cols-3">
              <Link href="#features" className="text-[var(--folio-muted)] transition hover:text-[var(--folio-ink)]">Features</Link>
              <Link href="#pricing" className="text-[var(--folio-muted)] transition hover:text-[var(--folio-ink)]">Pricing</Link>
              <Link href="/book/demo" className="text-[var(--folio-muted)] transition hover:text-[var(--folio-ink)]">Demo</Link>
              <Link href="/press" className="text-[var(--folio-muted)] transition hover:text-[var(--folio-ink)]">Press</Link>
              <Link href="/privacy" className="text-[var(--folio-muted)] transition hover:text-[var(--folio-ink)]">Privacy</Link>
              <Link href="/terms" className="text-[var(--folio-muted)] transition hover:text-[var(--folio-ink)]">Terms</Link>
            </div>
          </div>
          <div className="mt-10 border-t border-[var(--folio-hairline)] pt-6 text-sm text-[var(--folio-muted)]">
            © {new Date().getFullYear()} Riffle. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  )
}
