import type { Metadata } from 'next'
import Image from 'next/image'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Press & Brand Kit',
  description: 'QLICO brand assets, colors, boilerplate, and press resources.',
}

const COLORS = [
  { name: 'White', hex: '#ffffff' },
  { name: 'Ink', hex: '#141a3a' },
  { name: 'Violet', hex: '#3c2384' },
  { name: 'Gray', hex: '#575d78' },
  { name: 'Subtle', hex: '#f4f4f7' },
  { name: 'Hairline', hex: '#e3e4ea' },
]

const ASSETS = [
  { label: 'Logo lockup (PNG, transparent)', href: '/brand/qlico-logo.png' },
  { label: 'Logo lockup — white (PNG, transparent)', href: '/brand/qlico-logo-white.png' },
  { label: 'Mark only (PNG, transparent)', href: '/brand/qlico-mark.png' },
  { label: 'App icon (512×512)', href: '/brand/icon-512.png' },
  { label: 'Apple touch icon (180×180)', href: '/brand/apple-icon-180.png' },
  { label: 'Social share image (1200×630)', href: '/opengraph-image' },
  { label: 'Demo loop (GIF)', href: '/qlico-demo.gif' },
  { label: 'Web app manifest', href: '/manifest.webmanifest' },
]

const FACTS = [
  ['What it is', 'A studio + reader for interactive digital publications.'],
  ['Built for', 'Catalogs, lookbooks, portfolios, reports, and editorial.'],
  ['Platforms', 'Web, embeddable, and installable as an app (iOS/Android).'],
  ['Pricing', 'Free to start · Pro subscription · AppSumo lifetime deal.'],
]

export default function PressPage() {
  return (
    <main className="qlico-grain min-h-screen bg-[var(--background)] px-5 py-16 text-[var(--qlico-ink)] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-bold text-[var(--qlico-muted)] hover:text-[var(--qlico-ink)]">
          ← Back to QLICO
        </Link>

        <header className="mt-6">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-[var(--qlico-brass)]">Press &amp; brand</p>
          <h1 className="mt-3 font-display text-6xl font-semibold tracking-[-0.06em]">QLICO brand kit</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--qlico-muted)]">
            Everything you need to write about or feature QLICO — assets, colors, and boilerplate.
            For full guidelines, see BRAND.md in the repository.
          </p>
        </header>

        {/* Logo lockup */}
        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--qlico-muted)]">Logo</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex items-center justify-center rounded-[2rem] border border-[var(--qlico-border)] bg-white p-8">
              <Image src="/brand/qlico-logo.png" alt="QLICO logo on white" width={217} height={60} className="h-[60px] w-auto object-contain" />
            </div>
            <div className="flex items-center justify-center rounded-[2rem] border border-white/10 bg-[var(--qlico-ink)] p-8">
              <Image src="/brand/qlico-logo-white.png" alt="QLICO logo on ink" width={217} height={60} className="h-[60px] w-auto object-contain" />
            </div>
          </div>
        </section>

        {/* Colors */}
        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--qlico-muted)]">Color</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {COLORS.map((c) => (
              <div key={c.name} className="overflow-hidden rounded-[1.25rem] border border-[var(--qlico-border)] bg-white/50">
                <div className="h-20" style={{ background: c.hex }} />
                <div className="px-3 py-2">
                  <p className="text-sm font-bold">{c.name}</p>
                  <p className="font-mono text-xs text-[var(--qlico-muted)]">{c.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Assets */}
        <section className="mt-12">
          <h2 className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--qlico-muted)]">Downloadable assets</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ASSETS.map((a) => (
              <a
                key={a.href}
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-[1.25rem] border border-[var(--qlico-border)] bg-[#ffffff]/72 px-5 py-4 text-sm font-bold transition hover:-translate-y-0.5 hover:bg-white"
              >
                {a.label}
                <span className="text-[var(--qlico-teal)]">Open →</span>
              </a>
            ))}
          </div>
        </section>

        {/* Fast facts + boilerplate */}
        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-[var(--qlico-border)] bg-[#ffffff]/72 p-7">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">Fast facts</h2>
            <dl className="mt-4 divide-y divide-[var(--qlico-border)]">
              {FACTS.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[110px_1fr] gap-3 py-3">
                  <dt className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qlico-muted)]">{k}</dt>
                  <dd className="text-sm text-[var(--qlico-ink)]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-[2rem] border border-[var(--qlico-border)] bg-[#ffffff]/72 p-7">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">Boilerplate</h2>
            <p className="mt-4 text-[15px] leading-7 text-[var(--qlico-muted)]">
              QLICO turns static PDFs into interactive editions with hotspots, analytics, embeds,
              and brand control. Built for catalogs, lookbooks, portfolios, and reports that deserve
              more than a download link.
            </p>
            <p className="mt-4 text-sm font-bold">Press: press@qlico.app</p>
          </div>
        </section>
      </div>
    </main>
  )
}
