'use client'

import Link from 'next/link'
import { Gift, Plus } from 'lucide-react'
import { track } from '@vercel/analytics'
import Reveal from './Reveal'

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
    features: ['1 publication', '7-day analytics', 'QLICO watermark'],
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

export function Pricing() {
  return (
    <section id="pricing" className="px-5 py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-14 text-center">
          <h2 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">Simple, honest pricing.</h2>
          <p className="mt-4 text-lg text-[var(--qlico-muted)]">Start free. Upgrade when it earns its keep.</p>
        </Reveal>
        <div className="grid items-stretch gap-5 lg:grid-cols-3">
          {PLANS.map(({ name, price, cadence, desc, cta, href, features, featured }) => (
            <Reveal key={name}>
              <div
                className={`flex h-full flex-col rounded-3xl border p-8 ${
                  featured ? 'border-[var(--qlico-ink)] bg-white shadow-[0_30px_80px_rgba(0,0,0,0.1)]' : 'border-[var(--qlico-border)] bg-white'
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
                  {cadence && <span className="mb-1.5 text-sm text-[var(--qlico-muted)]">{cadence}</span>}
                </div>
                <p className="mt-3 text-[15px] text-[var(--qlico-muted)]">{desc}</p>
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
                  onClick={() => track('cta_click', { cta: name.toLowerCase(), location: 'pricing' })}
                  className={`mt-8 rounded-full px-5 py-3 text-center text-[15px] font-semibold transition ${
                    featured
                      ? 'bg-[var(--accent)] text-white hover:bg-[var(--accent-hover)]'
                      : 'bg-[var(--qlico-subtle)] text-[var(--qlico-ink)] hover:bg-[#ececef]'
                  }`}
                >
                  {cta}
                </Link>
              </div>
            </Reveal>
          ))}
        </div>

        <Reveal className="mt-6">
          <div className="flex flex-col items-center justify-between gap-4 rounded-2xl border border-[var(--qlico-border)] bg-white px-7 py-5 text-center sm:flex-row sm:text-left">
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
  )
}
