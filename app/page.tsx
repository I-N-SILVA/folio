'use client'

import dynamic from 'next/dynamic'
import Image from 'next/image'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { m, LazyMotion, domAnimation, useReducedMotion, useScroll, useSpring, useTransform } from 'framer-motion'
import {
  BarChart2,
  BookOpen,
  ChevronDown,
  Code2,
  Gift,
  Palette,
  Plus,
  RefreshCw,
  ShoppingBag,
} from 'lucide-react'
import Reveal from '@/components/landing/Reveal'
import { NumberTicker } from '@/components/landing/NumberTicker'
import { MagneticButton } from '@/components/landing/MagneticButton'

const HeroShowcase = dynamic(() => import('@/components/landing/HeroShowcase'), {
  ssr: false,
  loading: () => <div className="h-full w-full animate-pulse bg-[#f5f5f7]" />,
})

function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })
  return <m.div style={{ scaleX }} className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-[var(--accent)]" />
}

const STEPS = [
  ['01', 'Compose', 'Start from a PDF or build page-by-page with modular blocks.'],
  ['02', 'Enrich', 'Add hotspots, lead gates, themes, and metadata.'],
  ['03', 'Publish', 'Share a hosted reader, embed it anywhere, measure everything.'],
]

const STATS = [
  { value: 10, suffix: '×', label: 'More engaging than a static PDF' },
  { value: 3, suffix: ' min', label: 'From PDF to published edition' },
  { value: 100, suffix: '%', label: 'Your data, your infrastructure' },
]

const FAQS = [
  { q: 'How is this different from a flipbook tool?', a: 'KLICKO makes editions, not exports. Pages can be shoppable (checkout in place), bound to live data (prices, stock, dates that update after publish), and read with a tactile fore-edge you browse to navigate. A PDF can’t do any of that.' },
  { q: 'Do readers need an account or app?', a: 'No. Every edition is a hosted link that opens instantly in any browser, and embeds anywhere with one line of code.' },
  { q: 'Can I import an existing PDF?', a: 'Yes. Drop in a PDF and KLICKO turns each page into an interactive spread you can enrich with hotspots, links, and media.' },
  { q: 'Where does my analytics data live?', a: 'Reader intelligence — opens, dwell time, completion, hotspot clicks — is captured into your own Supabase project, so you own the data.' },
  { q: 'Is KLICKO installable as an app?', a: 'Yes. KLICKO is a progressive web app you can install on iOS and Android, and it works offline.' },
  { q: 'Can I use my own brand and domain?', a: 'Pro and lifetime plans let you ship on a custom domain with your own theme and no KLICKO watermark.' },
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
    features: ['1 publication', '7-day analytics', 'KLICKO watermark'],
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

function Mark({ className = '' }: { className?: string }) {
  return (
    <Image src="/brand/klicko-logo.png" alt="KLICKO" width={116} height={32} priority className={`object-contain ${className}`} />
  )
}

/** Word-by-word blur-up reveal for the hero headline. */
function HeadlineReveal({ text, className = '' }: { text: string; className?: string }) {
  const reduce = useReducedMotion()
  const words = text.split(' ')
  return (
    <h1 className={className}>
      {words.map((w, i) => (
        <m.span
          key={i}
          className="inline-block"
          initial={reduce ? { opacity: 0 } : { opacity: 0, y: 18, filter: 'blur(10px)' }}
          animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
          transition={
            reduce
              ? { duration: 0.3 }
              : { type: 'spring', stiffness: 130, damping: 18, delay: 0.15 + i * 0.13 }
          }
        >
          {w}
          {i < words.length - 1 ? ' ' : ''}
        </m.span>
      ))}
    </h1>
  )
}

/** Browser mockup that straightens from a slight tilt as it scrolls in. */
function ProductShot() {
  const ref = useRef<HTMLDivElement>(null)
  const reduce = useReducedMotion()
  const { scrollYProgress } = useScroll({ target: ref, offset: ['start end', 'center center'] })
  const rotateX = useTransform(scrollYProgress, [0, 1], reduce ? [0, 0] : [12, 0])
  const scale = useTransform(scrollYProgress, [0, 1], reduce ? [1, 1] : [0.95, 1])
  const opacity = useTransform(scrollYProgress, [0, 0.55], [0.35, 1])

  return (
    <div ref={ref} className="relative mx-auto mt-16 max-w-5xl" style={{ perspective: 1400 }}>
      <m.div
        style={{ rotateX, scale, opacity, transformStyle: 'preserve-3d' }}
        className="relative overflow-hidden rounded-[1.5rem] border border-[var(--folio-border)] bg-white shadow-[0_50px_140px_-30px_rgba(0,0,0,0.4)]"
      >
        <div className="flex items-center gap-1.5 border-b border-[var(--folio-hairline)] bg-[#fbfbfd] px-4 py-3">
          <span className="h-3 w-3 rounded-full bg-[#e1e1e6]" />
          <span className="h-3 w-3 rounded-full bg-[#e1e1e6]" />
          <span className="h-3 w-3 rounded-full bg-[#e1e1e6]" />
          <div className="mx-auto flex items-center gap-1.5 rounded-md bg-white px-3 py-1 text-left text-xs text-[var(--folio-muted)] shadow-sm">
            <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="opacity-60"><rect x="5" y="11" width="14" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>
            klicko.app/book/demo
          </div>
        </div>
        <div className="aspect-[16/10] bg-[#f5f5f7]">
          <HeroShowcase />
        </div>
        {/* Accent border beam */}
        <span aria-hidden className="folio-beam" />
      </m.div>
      {/* Soft floor reflection */}
      <div
        aria-hidden
        className="pointer-events-none absolute -bottom-10 left-1/2 -z-10 h-24 w-[78%] -translate-x-1/2 rounded-[50%] bg-black/15 blur-3xl"
      />
    </div>
  )
}

/** Tiny animated bar chart for the analytics bento tile. */
function MiniBars() {
  const reduce = useReducedMotion()
  const bars = [38, 62, 48, 80, 56, 95]
  return (
    <div className="flex h-16 items-end gap-1.5">
      {bars.map((h, i) => (
        <m.span
          key={i}
          className="w-full rounded-sm bg-[var(--accent)]/85"
          initial={{ height: reduce ? `${h}%` : '8%' }}
          whileInView={{ height: `${h}%` }}
          viewport={{ once: true, amount: 0.8 }}
          transition={{ delay: i * 0.06, type: 'spring', stiffness: 120, damping: 16 }}
        />
      ))}
    </div>
  )
}

/** Pulsing hotspot dots for the hotspot bento tile. */
function MiniHotspots() {
  const dots = [
    { x: '22%', y: '34%' },
    { x: '64%', y: '52%' },
    { x: '44%', y: '74%' },
  ]
  return (
    <div className="relative h-16 w-full rounded-lg bg-[var(--folio-subtle)]">
      {dots.map((d, i) => (
        <span key={i} className="folio-pulse absolute h-2.5 w-2.5 rounded-full bg-[var(--accent)]" style={{ left: d.x, top: d.y }} />
      ))}
    </div>
  )
}

type Tile = {
  icon: typeof BookOpen
  title: string
  desc: string
  span: string
  visual?: 'bars' | 'hotspots'
}

const TILES: Tile[] = [
  { icon: BookOpen, title: 'Tactile reader', desc: 'A fluid page-turn that feels like a printed object — riffle the fore-edge to fly anywhere.', span: 'lg:col-span-2' },
  { icon: ShoppingBag, title: 'Shoppable hotspots', desc: 'Pin products onto the page — readers check out without leaving.', span: 'lg:col-span-1', visual: 'hotspots' },
  { icon: BarChart2, title: 'Reader analytics', desc: 'Opens, dwell time, completion — in your own data layer.', span: 'lg:col-span-1', visual: 'bars' },
  { icon: RefreshCw, title: 'Living editions', desc: 'Bind prices, stock, and dates. Publish once; it stays current.', span: 'lg:col-span-1' },
  { icon: Code2, title: 'One-line embeds', desc: 'Drop a responsive edition into any site, store, or CMS.', span: 'lg:col-span-1' },
  { icon: Palette, title: 'Made to match', desc: 'Themes, custom domains, and no watermark on paid plans.', span: 'lg:col-span-2' },
]

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
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-[var(--background)] text-[var(--folio-ink)]">
        <ScrollProgress />
      {/* Nav */}
      <header
        className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
          scrolled
            ? 'border-b border-[var(--folio-hairline)] bg-white/60 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.06)]'
            : 'border-b border-transparent bg-transparent'
        }`}
      >
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
          <Link href="/" className="flex items-center" aria-label="KLICKO home">
            <Mark className="h-7 w-auto" />
          </Link>
          <nav className="hidden items-center gap-8 text-[13px] font-medium text-[var(--folio-muted)] md:flex">
            <Link href="#features" className="transition hover:text-[var(--folio-ink)]">Features</Link>
            <Link href="#how" className="transition hover:text-[var(--folio-ink)]">How it works</Link>
            <Link href="#pricing" className="transition hover:text-[var(--folio-ink)]">Pricing</Link>
            <Link href="/book/demo" className="transition hover:text-[var(--folio-ink)]">Demo</Link>
          </nav>
          <div className="flex items-center gap-2">
            <Link href="/login" className="hidden rounded-full px-4 py-1.5 text-[13px] font-medium text-[var(--folio-ink)] transition hover:bg-black/5 active:scale-[0.97] sm:block">
              Sign in
            </Link>
            <Link href="/login" className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[var(--accent-hover)] active:scale-[0.97]">
              Get started
            </Link>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="relative overflow-hidden px-5 pb-16 pt-32 text-center sm:pt-40">
          <div aria-hidden className="pointer-events-none absolute inset-0 -z-10 overflow-hidden">
            <m.div
              className="absolute left-[20%] top-[-10%] h-[500px] w-[500px] rounded-full bg-[var(--accent)]/15 blur-[100px]"
              animate={{ x: [0, 100, 0], y: [0, 50, 0] }}
              transition={{ duration: 15, repeat: Infinity, ease: 'easeInOut' }}
            />
            <m.div
              className="absolute right-[20%] top-[20%] h-[400px] w-[400px] rounded-full bg-[#00d0ff]/15 blur-[100px]"
              animate={{ x: [0, -100, 0], y: [0, -50, 0] }}
              transition={{ duration: 18, repeat: Infinity, ease: 'easeInOut' }}
            />
          </div>
          <div className="mx-auto max-w-3xl">
            <m.span
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5 }}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--folio-border)] bg-white/70 px-3.5 py-1.5 text-[13px] font-medium text-[var(--folio-muted)] backdrop-blur"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-[var(--accent)]" />
              Interactive publishing
            </m.span>
            <HeadlineReveal
              text="Flip through anything."
              className="font-display mt-6 text-6xl font-semibold leading-[1.0] tracking-[-0.02em] sm:text-7xl lg:text-[5.5rem]"
            />
            <m.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5, duration: 0.6 }}
              className="mx-auto mt-6 max-w-xl text-xl leading-8 text-[var(--folio-muted)]"
            >
              KLICKO turns static PDFs into interactive editions — with hotspots, analytics, and
              one-line embeds. Built for catalogs, lookbooks, portfolios, and reports.
            </m.p>
            <m.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.65, duration: 0.6 }}
              className="mt-9 flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <MagneticButton
                href="/login"
                className="w-full rounded-full bg-[var(--accent)] px-7 py-3.5 text-center text-[15px] font-semibold text-white shadow-[0_10px_30px_-8px_rgba(60,35,132,0.6)] transition-colors hover:bg-[var(--accent-hover)] sm:w-auto"
              >
                Start for free
              </MagneticButton>
              <Link href="/book/demo" className="text-[15px] font-medium text-[var(--accent)] transition hover:underline">
                View the demo →
              </Link>
            </m.div>
          </div>

          <ProductShot />
        </section>

        {/* Features — bento */}
        <section id="features" className="px-5 py-28">
          <div className="mx-auto max-w-6xl">
            <Reveal className="mx-auto mb-14 max-w-2xl text-center">
              <span className="mx-auto mb-5 block h-9 w-[3px] rounded-full bg-[var(--accent)]" />
              <h2 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">Everything a page can be.</h2>
              <p className="mt-4 text-lg leading-8 text-[var(--folio-muted)]">
                A studio, a reader, and the intelligence in between.
              </p>
            </Reveal>
            <div className="grid auto-rows-fr grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {TILES.map(({ icon: Icon, title, desc, span, visual }, i) => (
                <Reveal key={title} delay={(i % 4) * 70} className={span}>
                  <div className="group flex h-full flex-col rounded-3xl border border-[var(--folio-border)] bg-white p-7 transition-all duration-300 hover:-translate-y-1 hover:shadow-[0_24px_60px_rgba(0,0,0,0.08)]">
                    <div className="grid h-12 w-12 place-items-center rounded-2xl bg-[var(--folio-subtle)] text-[var(--folio-ink)] transition-colors duration-300 group-hover:bg-[var(--folio-ink)] group-hover:text-white">
                      <Icon size={20} strokeWidth={1.75} />
                    </div>
                    <h3 className="mt-5 text-lg font-semibold tracking-[-0.01em]">{title}</h3>
                    <p className="mt-2 text-[15px] leading-7 text-[var(--folio-muted)]">{desc}</p>
                    {visual === 'bars' && <div className="mt-auto pt-6"><MiniBars /></div>}
                    {visual === 'hotspots' && <div className="mt-auto pt-6"><MiniHotspots /></div>}
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
              <h2 className="font-display text-4xl font-semibold leading-[1.08] tracking-[-0.02em] sm:text-6xl">
                A download link is where good work goes to be forgotten.
              </h2>
              <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/60">
                KLICKO gives your publication a reason to be opened, explored, and finished — and
                shows you exactly what held attention.
              </p>
              <Link href="/login" className="mt-9 inline-block rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-[var(--folio-ink)] transition hover:bg-white/90">
                Create your first edition
              </Link>
            </Reveal>
          </div>
        </section>

        {/* Stats */}
        <section className="px-5 py-24">
          <div className="mx-auto grid max-w-4xl gap-10 text-center sm:grid-cols-3">
            {STATS.map((s) => (
              <Reveal key={s.label}>
                <div className="font-display text-6xl font-semibold tracking-[-0.03em] text-[var(--folio-ink)]">
                  <NumberTicker value={s.value} suffix={s.suffix} />
                </div>
                <p className="mx-auto mt-3 max-w-[12rem] text-[15px] leading-6 text-[var(--folio-muted)]">{s.label}</p>
              </Reveal>
            ))}
          </div>
        </section>

        {/* How it works */}
        <section id="how" className="bg-[var(--background-alt)] px-5 py-28">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mb-14 max-w-2xl">
              <span className="mb-5 block h-9 w-[3px] rounded-full bg-[var(--accent)]" />
              <h2 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">From flat file to living edition.</h2>
            </Reveal>

            {/* Animated flow conduit */}
            <div className="relative mb-6 hidden h-[3px] overflow-hidden rounded-full bg-[var(--folio-border)] lg:block">
              <div className="folio-flow-line absolute inset-0" />
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              {STEPS.map(([num, title, desc], i) => (
                <Reveal key={num} delay={i * 90}>
                  <div className="h-full rounded-2xl border border-[var(--folio-border)] bg-white p-8">
                    <span className="font-display text-sm font-semibold text-[var(--accent)]">{num}</span>
                    <h3 className="mt-4 text-xl font-semibold tracking-[-0.01em]">{title}</h3>
                    <p className="mt-2 text-[15px] leading-7 text-[var(--folio-muted)]">{desc}</p>
                  </div>
                </Reveal>
              ))}
            </div>
          </div>
        </section>

        {/* Pricing */}
        <section id="pricing" className="px-5 py-28">
          <div className="mx-auto max-w-5xl">
            <Reveal className="mb-14 text-center">
              <h2 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">Simple, honest pricing.</h2>
              <p className="mt-4 text-lg text-[var(--folio-muted)]">Start free. Upgrade when it earns its keep.</p>
            </Reveal>
            <div className="grid items-stretch gap-5 lg:grid-cols-3">
              {PLANS.map(({ name, price, cadence, desc, cta, href, features, featured }) => (
                <Reveal key={name}>
                  <div
                    className={`flex h-full flex-col rounded-3xl border p-8 ${
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
                      <span className="font-display text-5xl font-semibold tracking-[-0.03em]">{price}</span>
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
                </Reveal>
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
        <section id="faq" className="bg-[var(--background-alt)] px-5 py-28">
          <div className="mx-auto max-w-3xl">
            <Reveal className="mb-12 text-center">
              <h2 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">Questions, answered.</h2>
            </Reveal>
            <div>
              {FAQS.map((item) => (
                <FaqItem key={item.q} q={item.q} a={item.a} />
              ))}
            </div>
          </div>
        </section>

        {/* CTA */}
        <section className="px-5 py-28">
          <div className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-[var(--folio-ink)] px-8 py-20 text-center text-white">
            <Reveal>
              <h2 className="font-display mx-auto max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.02em] sm:text-5xl">
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
              <div className="flex items-center">
                <Mark className="h-7 w-auto" />
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
            © {new Date().getFullYear()} KLICKO. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
    </LazyMotion>
  )
}
