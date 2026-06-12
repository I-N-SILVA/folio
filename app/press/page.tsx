import type { Metadata } from 'next'
import Link from 'next/link'

export const metadata: Metadata = {
  title: 'Press & Brand Kit',
  description: 'Folio brand assets, colors, boilerplate, and press resources.',
}

const COLORS = [
  { name: 'Paper', hex: '#f6efe2' },
  { name: 'Ink', hex: '#1b1712' },
  { name: 'Teal', hex: '#0d6661' },
  { name: 'Brass', hex: '#b98235' },
  { name: 'Gold', hex: '#d6aa66' },
  { name: 'Oxblood', hex: '#6f302d' },
]

const ASSETS = [
  { label: 'App icon (512×512)', href: '/icon' },
  { label: 'Apple touch icon (180×180)', href: '/apple-icon' },
  { label: 'Social share image (1200×630)', href: '/opengraph-image' },
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
    <main className="folio-grain min-h-screen bg-[var(--background)] px-5 py-16 text-[var(--folio-ink)] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <Link href="/" className="text-sm font-bold text-[var(--folio-muted)] hover:text-[var(--folio-ink)]">
          ← Back to Folio
        </Link>

        <header className="mt-6">
          <p className="text-sm font-extrabold uppercase tracking-[0.24em] text-[var(--folio-brass)]">Press &amp; brand</p>
          <h1 className="mt-3 font-display text-6xl font-semibold tracking-[-0.06em]">Folio brand kit</h1>
          <p className="mt-4 max-w-2xl text-lg leading-8 text-[var(--folio-muted)]">
            Everything you need to write about or feature Folio — assets, colors, and boilerplate.
            For full guidelines, see BRAND.md in the repository.
          </p>
        </header>

        {/* Logo lockup */}
        <section className="mt-12">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--folio-muted)]">Logo</h2>
          <div className="mt-4 grid gap-4 sm:grid-cols-2">
            <div className="flex items-center gap-4 rounded-[2rem] border border-[var(--folio-border)] bg-[#fffaf0]/72 p-8">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--folio-ink)] text-2xl font-semibold text-[#f7ead4]">F</span>
              <span className="font-display text-4xl font-semibold tracking-[-0.04em]">Folio</span>
            </div>
            <div className="flex items-center gap-4 rounded-[2rem] border border-white/10 bg-[var(--folio-ink)] p-8 text-[#fbf1df]">
              <span className="grid h-14 w-14 place-items-center rounded-2xl bg-[#d6aa66] text-2xl font-semibold text-[#271c10]">F</span>
              <span className="font-display text-4xl font-semibold tracking-[-0.04em]">Folio</span>
            </div>
          </div>
        </section>

        {/* Colors */}
        <section className="mt-12">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--folio-muted)]">Color</h2>
          <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
            {COLORS.map((c) => (
              <div key={c.name} className="overflow-hidden rounded-[1.25rem] border border-[var(--folio-border)] bg-white/50">
                <div className="h-20" style={{ background: c.hex }} />
                <div className="px-3 py-2">
                  <p className="text-sm font-bold">{c.name}</p>
                  <p className="font-mono text-xs text-[var(--folio-muted)]">{c.hex}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Assets */}
        <section className="mt-12">
          <h2 className="text-xs font-extrabold uppercase tracking-[0.2em] text-[var(--folio-muted)]">Downloadable assets</h2>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            {ASSETS.map((a) => (
              <a
                key={a.href}
                href={a.href}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-between rounded-[1.25rem] border border-[var(--folio-border)] bg-[#fffaf0]/72 px-5 py-4 text-sm font-bold transition hover:-translate-y-0.5 hover:bg-white"
              >
                {a.label}
                <span className="text-[var(--folio-teal)]">Open →</span>
              </a>
            ))}
          </div>
        </section>

        {/* Fast facts + boilerplate */}
        <section className="mt-12 grid gap-6 lg:grid-cols-2">
          <div className="rounded-[2rem] border border-[var(--folio-border)] bg-[#fffaf0]/72 p-7">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">Fast facts</h2>
            <dl className="mt-4 divide-y divide-[var(--folio-border)]">
              {FACTS.map(([k, v]) => (
                <div key={k} className="grid grid-cols-[110px_1fr] gap-3 py-3">
                  <dt className="text-xs font-extrabold uppercase tracking-[0.14em] text-[var(--folio-muted)]">{k}</dt>
                  <dd className="text-sm text-[var(--folio-ink)]">{v}</dd>
                </div>
              ))}
            </dl>
          </div>
          <div className="rounded-[2rem] border border-[var(--folio-border)] bg-[#fffaf0]/72 p-7">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">Boilerplate</h2>
            <p className="mt-4 text-[15px] leading-7 text-[var(--folio-muted)]">
              Folio turns static PDFs into immersive, interactive flipbooks with hotspots, analytics,
              embeds, and brand control. Built for portfolios, catalogs, lookbooks, reports, and premium
              stories that deserve more than a download link.
            </p>
            <p className="mt-4 text-sm font-bold">Press: press@folio.new</p>
          </div>
        </section>
      </div>
    </main>
  )
}
