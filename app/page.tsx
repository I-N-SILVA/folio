'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  BarChart2,
  BookOpen,
  Check,
  Code2,
  FileUp,
  Palette,
  Sparkles,
  Target,
} from 'lucide-react'

const BrowserPreview = dynamic(() => import('@/components/landing/BrowserPreview'), {
  ssr: false,
  loading: () => (
    <div className="h-full w-full animate-pulse rounded-[1.75rem] border border-[var(--folio-border)] bg-[#f3eadb]" />
  ),
})

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Tactile page turns',
    desc: 'A polished 3D reader that feels editorial, not like another static PDF viewer.',
  },
  {
    icon: Target,
    title: 'Interactive hotspots',
    desc: 'Layer product details, video, links, and narrative cues directly onto the page.',
  },
  {
    icon: BarChart2,
    title: 'Reader intelligence',
    desc: 'Measure opens, dwell time, completion, and hotspot clicks from your own Supabase.',
  },
  {
    icon: FileUp,
    title: 'PDF to experience',
    desc: 'Import existing PDFs and turn them into hosted, interactive publications quickly.',
  },
  {
    icon: Code2,
    title: 'Elegant embeds',
    desc: 'Drop a responsive folio into landing pages, stores, docs, CMS pages, or portfolios.',
  },
  {
    icon: Palette,
    title: 'Brandable themes',
    desc: 'Shape the look for catalogs, lookbooks, reports, pitch decks, and creative portfolios.',
  },
]

const STEPS = [
  ['01', 'Compose', 'Start from a PDF or build page-by-page with modular content blocks.'],
  ['02', 'Embellish', 'Add hotspots, lead gates, metadata, custom themes, and publication settings.'],
  ['03', 'Publish', 'Share a hosted reader, embed it anywhere, and watch engagement unfold.'],
]

const PLANS = [
  {
    name: 'Free',
    price: 'Free',
    desc: 'For testing the format and publishing a first interactive book.',
    cta: 'Start free',
    features: ['1 book', 'Basic analytics for 7 days', 'Folio watermark'],
  },
  {
    name: 'Pro',
    price: '$19/mo',
    desc: 'For creators and teams who publish polished digital experiences often.',
    cta: 'Start Pro',
    featured: true,
    features: ['Unlimited books', '90-day analytics', 'Custom domain', 'No watermark', 'CSV export'],
  },
  {
    name: 'Self-hosted',
    price: '$199',
    desc: 'For teams who need ownership, data sovereignty, and infrastructure control.',
    cta: 'Get license',
    features: ['Everything in Pro', 'Your infrastructure', 'Data sovereignty', 'PDF import'],
  },
]

export default function HomePage() {
  return (
    <div className="min-h-screen overflow-hidden bg-[var(--background)] text-[var(--folio-ink)]">
      <header className="fixed inset-x-0 top-0 z-50 px-4 py-4">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between rounded-full border border-white/55 bg-[#fff9ed]/78 px-5 shadow-[0_18px_60px_rgba(45,31,15,0.12)] backdrop-blur-xl">
          <Link href="/" className="flex items-center gap-3" aria-label="Folio home">
            <span className="grid h-9 w-9 place-items-center rounded-full bg-[var(--folio-ink)] text-sm font-semibold text-[#f7ead4] shadow-lg shadow-black/10">
              F
            </span>
            <span className="font-display text-2xl font-semibold tracking-[-0.04em]">Folio</span>
          </Link>

          <nav className="flex items-center gap-1 text-sm font-semibold text-[var(--folio-muted)]">
            <Link href="/book/demo" className="hidden rounded-full px-4 py-2 transition hover:bg-black/5 hover:text-[var(--folio-ink)] sm:block">
              Demo
            </Link>
            <Link href="/login" className="rounded-full px-4 py-2 transition hover:bg-black/5 hover:text-[var(--folio-ink)]">
              Sign in
            </Link>
            <Link
              href="/login"
              className="rounded-full bg-[var(--folio-ink)] px-5 py-2.5 text-[#fbf1df] shadow-lg shadow-black/10 transition hover:-translate-y-0.5 hover:bg-[#33291e]"
            >
              Open Studio
            </Link>
          </nav>
        </div>
      </header>

      <main>
        <section className="folio-grain relative px-5 pb-20 pt-32 sm:pt-40">
          <div className="absolute left-1/2 top-0 -z-10 h-[720px] w-[920px] -translate-x-1/2 rounded-full bg-[radial-gradient(circle,rgba(185,130,53,0.26),rgba(13,102,97,0.16)_38%,transparent_68%)] blur-3xl" />
          <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="animate-folio-rise">
              <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-[var(--folio-border)] bg-white/45 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.24em] text-[var(--folio-teal)] shadow-sm">
                <Sparkles size={14} />
                Digital publishing with soul
              </div>
              <h1 className="font-display text-6xl font-semibold leading-[0.9] tracking-[-0.075em] text-[var(--folio-ink)] sm:text-7xl lg:text-8xl">
                Make every page feel collected.
              </h1>
              <p className="mt-7 max-w-xl text-lg leading-8 text-[var(--folio-muted)]">
                Folio turns static PDFs into immersive flipbooks with hotspots, analytics, embeds,
                and brand control. Built for portfolios, catalogs, lookbooks, reports, and premium
                stories that deserve more than a download link.
              </p>
              <div className="mt-9 flex flex-col gap-3 sm:flex-row">
                <Link
                  href="/login"
                  className="rounded-full bg-[var(--folio-teal)] px-7 py-4 text-center text-sm font-extrabold uppercase tracking-[0.16em] text-white shadow-[0_18px_35px_rgba(13,102,97,0.24)] transition hover:-translate-y-1 hover:bg-[#09514d]"
                >
                  Create a folio
                </Link>
                <Link
                  href="/book/demo"
                  className="rounded-full border border-[var(--folio-border)] bg-white/45 px-7 py-4 text-center text-sm font-extrabold uppercase tracking-[0.16em] text-[var(--folio-ink)] transition hover:-translate-y-1 hover:bg-white"
                >
                  View the demo
                </Link>
              </div>
            </div>

            <div className="relative animate-folio-rise [animation-delay:140ms]">
              <div className="absolute -left-8 top-10 hidden h-28 w-28 rotate-[-9deg] rounded-[2rem] border border-[var(--folio-border)] bg-[#792f2b] p-5 text-xs font-bold uppercase tracking-[0.2em] text-[#ffe7c2] shadow-2xl lg:block">
                Live reader
              </div>
              <div className="rounded-[2.25rem] border border-[#fff8ec] bg-[#211a13] p-3 shadow-[0_44px_110px_rgba(38,28,16,0.32)]">
                <div className="overflow-hidden rounded-[1.75rem] border border-white/10 bg-[#f6ead8]">
                  <div className="flex items-center gap-2 border-b border-black/10 bg-[#2b2218] px-5 py-4">
                    <span className="h-3 w-3 rounded-full bg-[#d96155]" />
                    <span className="h-3 w-3 rounded-full bg-[#d7a847]" />
                    <span className="h-3 w-3 rounded-full bg-[#6e9d74]" />
                    <div className="ml-3 max-w-xs flex-1 rounded-full border border-white/10 bg-white/8 px-4 py-1.5 text-xs text-[#e9d8bd]">
                      folio.app/book/demo
                    </div>
                  </div>
                  <div className="aspect-[16/10] bg-[#efe2ce]">
                    <BrowserPreview />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="px-5 py-20">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-5 md:grid-cols-3">
              {[
                ['2 min', 'to publish a shareable interactive reader'],
                ['100%', 'self-host friendly with your own data layer'],
                ['1 line', 'to embed a folio into any marketing surface'],
              ].map(([stat, label]) => (
                <div key={stat} className="rounded-[2rem] border border-[var(--folio-border)] bg-[#fffaf0]/68 p-7 shadow-sm backdrop-blur">
                  <p className="font-display text-5xl font-semibold tracking-[-0.06em] text-[var(--folio-ink)]">{stat}</p>
                  <p className="mt-3 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--folio-muted)]">{label}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section id="features" className="px-5 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 max-w-3xl">
              <p className="text-sm font-extrabold uppercase tracking-[0.24em] text-[var(--folio-brass)]">
                The publishing layer
              </p>
              <h2 className="mt-4 font-display text-5xl font-semibold leading-none tracking-[-0.06em] sm:text-6xl">
                A studio, a reader, and the intelligence between them.
              </h2>
            </div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {FEATURES.map(({ icon: Icon, title, desc }, index) => (
                <article
                  key={title}
                  className="group rounded-[2rem] border border-[var(--folio-border)] bg-[#fffaf0]/72 p-7 shadow-sm transition duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_24px_60px_rgba(43,31,18,0.14)]"
                  style={{ animationDelay: `${index * 65}ms` }}
                >
                  <div className="mb-7 grid h-12 w-12 place-items-center rounded-2xl bg-[var(--folio-ink)] text-[#f7e7c9] shadow-lg shadow-black/10 transition group-hover:rotate-3 group-hover:bg-[var(--folio-teal)]">
                    <Icon size={21} />
                  </div>
                  <h3 className="font-display text-2xl font-semibold tracking-[-0.04em]">{title}</h3>
                  <p className="mt-3 text-sm leading-6 text-[var(--folio-muted)]">{desc}</p>
                </article>
              ))}
            </div>
          </div>
        </section>

        <section id="how-it-works" className="bg-[var(--folio-ink)] px-5 py-24 text-[#fbf1df]">
          <div className="mx-auto max-w-6xl">
            <div className="grid gap-12 lg:grid-cols-[0.8fr_1.2fr]">
              <div>
                <p className="text-sm font-extrabold uppercase tracking-[0.24em] text-[#d6aa66]">
                  Workflow
                </p>
                <h2 className="mt-4 font-display text-5xl font-semibold leading-none tracking-[-0.06em]">
                  From flat asset to living publication.
                </h2>
              </div>
              <div className="grid gap-4">
                {STEPS.map(([num, title, desc]) => (
                  <div key={num} className="grid gap-5 rounded-[2rem] border border-white/10 bg-white/[0.055] p-6 backdrop-blur sm:grid-cols-[90px_1fr]">
                    <span className="font-display text-5xl font-semibold tracking-[-0.06em] text-[#d6aa66]">{num}</span>
                    <div>
                      <h3 className="text-xl font-extrabold">{title}</h3>
                      <p className="mt-2 leading-7 text-[#d8c6aa]">{desc}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section id="pricing" className="px-5 py-24">
          <div className="mx-auto max-w-6xl">
            <div className="mb-14 text-center">
              <p className="text-sm font-extrabold uppercase tracking-[0.24em] text-[var(--folio-brass)]">
                Pricing
              </p>
              <h2 className="mt-4 font-display text-5xl font-semibold tracking-[-0.06em]">
                Start small. Publish beautifully.
              </h2>
            </div>
            <div className="grid items-stretch gap-5 lg:grid-cols-3">
              {PLANS.map(({ name, price, desc, cta, features, featured }) => (
                <article
                  key={name}
                  className={`relative flex rounded-[2rem] border p-7 shadow-sm ${
                    featured
                      ? 'border-[#dac196] bg-[var(--folio-ink)] text-[#fbf1df] shadow-[0_30px_80px_rgba(32,25,18,0.28)] lg:-mt-5 lg:mb-5'
                      : 'border-[var(--folio-border)] bg-[#fffaf0]/72'
                  }`}
                >
                  {featured && (
                    <span className="absolute -top-3 left-7 rounded-full bg-[#d6aa66] px-4 py-1 text-xs font-extrabold uppercase tracking-[0.18em] text-[#271c10]">
                      Most popular
                    </span>
                  )}
                  <div className="flex w-full flex-col">
                    <h3 className="font-display text-3xl font-semibold tracking-[-0.05em]">{name}</h3>
                    <p className={`mt-3 min-h-14 text-sm leading-6 ${featured ? 'text-[#d8c6aa]' : 'text-[var(--folio-muted)]'}`}>
                      {desc}
                    </p>
                    <p className="mt-7 font-display text-5xl font-semibold tracking-[-0.06em]">{price}</p>
                    <ul className="mt-8 flex-1 space-y-3">
                      {features.map((feature) => (
                        <li key={feature} className="flex gap-3 text-sm font-semibold">
                          <Check size={17} className={featured ? 'mt-0.5 text-[#d6aa66]' : 'mt-0.5 text-[var(--folio-teal)]'} />
                          <span className={featured ? 'text-[#f7ead4]' : 'text-[var(--folio-ink)]'}>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Link
                      href="/login"
                      className={`mt-8 rounded-full px-5 py-3 text-center text-sm font-extrabold uppercase tracking-[0.16em] transition hover:-translate-y-1 ${
                        featured
                          ? 'bg-[#fbf1df] text-[var(--folio-ink)] hover:bg-white'
                          : 'border border-[var(--folio-border)] bg-white/50 text-[var(--folio-ink)] hover:bg-white'
                      }`}
                    >
                      {cta}
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      </main>

      <footer className="border-t border-[var(--folio-border)] bg-[#eee1cc] px-5 py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="font-display text-3xl font-semibold tracking-[-0.05em]">Folio</p>
            <p className="mt-1 text-sm font-semibold text-[var(--folio-muted)]">
              Interactive flipbooks with craft, context, and control.
            </p>
          </div>
          <nav className="flex flex-wrap items-center gap-5 text-sm font-bold text-[var(--folio-muted)]">
            <Link href="/book/demo" className="hover:text-[var(--folio-ink)]">Demo</Link>
            <Link href="/login" className="hover:text-[var(--folio-ink)]">Sign in</Link>
            <a href="https://github.com" target="_blank" rel="noopener noreferrer" className="hover:text-[var(--folio-ink)]">
              GitHub
            </a>
          </nav>
        </div>
      </footer>
    </div>
  )
}
