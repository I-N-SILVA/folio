'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { trackProduct } from '@/lib/product-analytics'
import Reveal from './Reveal'

const PLANS: {
  name: string
  price: string
  cadence?: string
  desc: string
  cta: string
  href: string
  featured?: boolean
  note?: string
  features: string[]
}[] = [
  {
    name: 'Free',
    price: '$0',
    desc: 'Enough to publish something real and see who reads it.',
    cta: 'Start free',
    href: '/login',
    features: ['3 editions', 'PDF import', 'Hotspots and embeds', '30-day analytics', 'QLICO badge on the reader'],
  },
  {
    name: 'Pro',
    price: '$19',
    cadence: '/mo',
    desc: 'For anyone whose editions have to bring something back.',
    cta: 'Get Pro',
    href: '/login?next=%2Faccount',
    featured: true,
    features: [
      'Unlimited editions',
      'Email capture with lead export',
      '12-month analytics',
      'No QLICO badge',
      'CSV export of every event',
    ],
  },
  {
    // There is no self-serve checkout for this tier — it is sold as a lifetime
    // deal and redeemed with a code. Saying "see the deal" and landing people
    // on a code box they can't fill is worse than saying so plainly.
    name: 'Lifetime',
    price: '$59+',
    desc: 'Sold as a one-time lifetime deal on AppSumo.',
    cta: 'Redeem your code',
    href: '/redeem',
    note: 'Bought a code? Redeem it here. Tiers unlock more editions, longer analytics, and white-label.',
    features: ['Everything in Pro', 'One payment, no renewal', 'Stackable tiers', 'Lifetime updates'],
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
          {PLANS.map(({ name, price, cadence, desc, cta, href, features, featured, note }) => (
            <Reveal key={name}>
              <div
                className={`flex h-full flex-col rounded-3xl border p-8 ${
                  featured ? 'border-[var(--qlico-ink)] bg-[var(--qlico-paper)] shadow-[0_30px_80px_rgba(0,0,0,0.1)]' : 'border-[var(--qlico-border)] bg-[var(--qlico-paper)]'
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
                {note && (
                  <p className="mt-3 rounded-xl bg-[var(--qlico-subtle)] px-3 py-2 text-[13px] leading-5 text-[var(--qlico-muted)]">
                    {note}
                  </p>
                )}
                <ul className="mt-7 flex-1 space-y-3">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2.5 text-[15px]">
                      <Plus size={16} className="mt-1 shrink-0 text-[var(--accent-fg)]" />
                      <span>{f}</span>
                    </li>
                  ))}
                </ul>
                <Link
                  href={href}
                  onClick={() => trackProduct('cta_click', { cta: name.toLowerCase(), location: 'pricing' })}
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

        {/* The Lifetime column now says this itself, so the banner that used to
            sit here was the third place on one screen offering the same link. */}
        <Reveal className="mt-6">
          <p className="text-center text-[13px] leading-6 text-[var(--qlico-muted)]">
            Every plan includes the full reader, PDF import, hotspots, and embeds. You can export
            your events and captured emails as CSV on any paid plan, at any time.
          </p>
        </Reveal>
      </div>
    </section>
  )
}
