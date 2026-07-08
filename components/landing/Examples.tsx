'use client'

import Link from 'next/link'
import { track } from '@vercel/analytics'
import Reveal from './Reveal'

const EXAMPLES = [
  {
    slug: 'demo-lookbook',
    tag: 'Commerce',
    eyebrow: 'Summer 2026 · Lookbook',
    title: 'Ondine',
    desc: 'A shoppable lookbook — live stock and checkout without leaving the page.',
    bg: '#fffbf0',
    ink: '#141a3a',
  },
  {
    slug: 'demo-report',
    tag: 'Business',
    eyebrow: 'Annual report · 2026',
    title: 'The Attention Report',
    desc: 'A living report — figures bound to data that updates after publish.',
    bg: '#1c1c2e',
    ink: '#ffffff',
  },
  {
    slug: 'demo-portfolio',
    tag: 'Creative',
    eyebrow: 'Portfolio · 2024–2026',
    title: 'Mara Ito',
    desc: 'A portfolio whose case studies carry role and results one tap away.',
    bg: '#111111',
    ink: '#ffffff',
  },
]

export function Examples() {
  return (
    <section id="examples" className="px-5 py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-14 max-w-2xl">
          <span className="mb-5 block h-9 w-[3px] rounded-full bg-[var(--accent)]" />
          <h2 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">Don&apos;t take our word for it. Flip one.</h2>
          <p className="mt-4 text-[15px] leading-7 text-[var(--qlico-muted)]">
            Three live editions — a shoppable lookbook, a living report, and a portfolio. No signup, no app.
          </p>
        </Reveal>
        <div className="grid gap-4 sm:grid-cols-3">
          {EXAMPLES.map((ex, i) => (
            <Reveal key={ex.slug} delay={i * 90}>
              <Link
                href={`/book/${ex.slug}`}
                onClick={() => track('demo_open', { edition: ex.slug, location: 'examples' })}
                className="group block h-full overflow-hidden rounded-2xl border border-[var(--qlico-border)] bg-white transition hover:-translate-y-1 hover:shadow-[var(--qlico-shadow)]"
              >
                <div
                  className="flex aspect-[4/3] flex-col items-center justify-center gap-2 px-6 text-center"
                  style={{ background: ex.bg, color: ex.ink }}
                >
                  <span className="text-[10px] font-semibold uppercase tracking-[0.24em] opacity-70">{ex.eyebrow}</span>
                  <span className="font-display text-2xl font-semibold leading-tight tracking-[-0.02em]">{ex.title}</span>
                </div>
                <div className="p-6">
                  <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--accent)]">{ex.tag}</span>
                  <p className="mt-2 text-[15px] leading-7 text-[var(--qlico-muted)]">{ex.desc}</p>
                  <span className="mt-3 inline-block text-sm font-semibold text-[var(--qlico-ink)] transition group-hover:translate-x-1">
                    Flip through →
                  </span>
                </div>
              </Link>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
