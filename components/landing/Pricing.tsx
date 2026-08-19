'use client'

import Link from 'next/link'
import { Plus } from 'lucide-react'
import { trackProduct } from '@/lib/product-analytics'
import { motion, useMotionValue, useSpring, useTransform, useReducedMotion } from 'framer-motion'
import Reveal from './Reveal'

const PLANS: {
  name: string
  price: string
  cadence?: string
  desc: string
  cta: string
  href: string
  featured?: boolean
  isLifetime?: boolean
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
    name: 'Lifetime',
    price: '$59+',
    desc: 'Sold as a one-time lifetime deal on AppSumo.',
    cta: 'Redeem your code',
    href: '/redeem',
    isLifetime: true,
    note: 'Bought a code? Redeem it here. Tiers unlock more editions, longer analytics, and white-label.',
    features: ['Everything in Pro', 'One payment, no renewal', 'Stackable tiers', 'Lifetime updates'],
  },
]

function TiltCard({ children, featured }: { children: React.ReactNode; featured?: boolean }) {
  const reduce = useReducedMotion()
  const x = useMotionValue(0)
  const y = useMotionValue(0)
  const springConfig = { damping: 20, stiffness: 100 }
  const mouseX = useSpring(x, springConfig)
  const mouseY = useSpring(y, springConfig)
  
  const rotateX = useTransform(mouseY, [-0.5, 0.5], reduce ? [0, 0] : [7, -7])
  const rotateY = useTransform(mouseX, [-0.5, 0.5], reduce ? [0, 0] : [-7, 7])
  const glareOpacity = useTransform(y, [-0.5, 0.5], [0, 0.15])
  const glareY = useTransform(y, [-0.5, 0.5], ['-100%', '100%'])

  function handleMouseMove(e: React.MouseEvent<HTMLDivElement>) {
    if (reduce) return
    const rect = e.currentTarget.getBoundingClientRect()
    x.set((e.clientX - rect.left) / rect.width - 0.5)
    y.set((e.clientY - rect.top) / rect.height - 0.5)
  }

  function handleMouseLeave() {
    x.set(0)
    y.set(0)
  }

  return (
    <motion.div
      onMouseMove={handleMouseMove}
      onMouseLeave={handleMouseLeave}
      style={{ perspective: 1200 }}
      className="h-full"
    >
      <motion.div
        style={{ rotateX, rotateY, transformStyle: 'preserve-3d' }}
        className={`relative flex h-full flex-col overflow-hidden rounded-3xl border p-8 transition-colors ${
          featured ? 'border-[var(--qlico-ink)] bg-[var(--qlico-paper)] shadow-[0_30px_80px_rgba(0,0,0,0.1)]' : 'border-[var(--qlico-border)] bg-[var(--qlico-paper)]'
        }`}
      >
        {/* Fake Ambient Sheen */}
        {!reduce && (
          <motion.div 
            className="pointer-events-none absolute inset-0 z-0 bg-gradient-to-b from-white to-transparent" 
            style={{ opacity: glareOpacity, y: glareY }}
          />
        )}
        
        <div style={{ transform: 'translateZ(30px)' }} className="flex h-full flex-col z-10">
          {children}
        </div>
      </motion.div>
    </motion.div>
  )
}

export function Pricing() {
  return (
    <section id="pricing" className="px-5 py-32 sm:py-48">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-20 text-center">
          <span className="mx-auto mb-6 block h-10 w-[3px] rounded-full bg-[var(--accent)]" />
          <h2 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl lg:text-6xl">Simple, honest pricing.</h2>
          <p className="mt-4 text-lg text-[var(--qlico-muted)]">Start free. Upgrade when it earns its keep.</p>
        </Reveal>
        <div className="grid items-stretch gap-6 lg:grid-cols-3">
          {PLANS.map(({ name, price, cadence, desc, cta, href, features, featured, isLifetime, note }, i) => (
            <Reveal key={name} delay={i * 100}>
              <TiltCard featured={featured}>
                {featured && (
                  <span className="mb-4 inline-block w-fit rounded-full bg-[var(--accent)] px-3 py-1 text-xs font-semibold text-[var(--accent-contrast)]">
                    Most popular
                  </span>
                )}
                {isLifetime && (
                  <span className="mb-4 inline-flex w-fit items-center gap-1 rounded-full border border-yellow-500/30 bg-yellow-500/10 px-3 py-1 text-xs font-semibold text-yellow-700 dark:text-yellow-500">
                    <span className="h-1.5 w-1.5 rounded-full bg-yellow-500" />
                    AppSumo Exclusive
                  </span>
                )}
                <h3 className="text-lg font-semibold">{name}</h3>
                <div className="mt-3 flex items-end gap-1">
                  <span className="font-display text-5xl font-semibold tracking-[-0.03em]">{price}</span>
                  {cadence && <span className="mb-1.5 text-sm text-[var(--qlico-muted)]">{cadence}</span>}
                </div>
                <p className="mt-4 text-[15px] text-[var(--qlico-muted)] leading-relaxed">{desc}</p>
                {note && (
                  <p className="mt-4 rounded-xl bg-[var(--qlico-subtle)] px-3 py-2 text-[13px] leading-5 text-[var(--qlico-muted)] border border-[var(--qlico-border)]">
                    {note}
                  </p>
                )}
                <ul className="mt-8 flex-1 space-y-4">
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
                  className={`mt-10 rounded-full px-5 py-3.5 text-center text-[15px] font-semibold transition ${
                    featured
                      ? 'bg-[var(--accent)] text-[var(--accent-contrast)] shadow-[0_12px_24px_rgba(255,59,0,0.18)] hover:-translate-y-0.5 hover:bg-[var(--accent-hover)]'
                      : 'bg-[var(--qlico-subtle)] text-[var(--qlico-ink)] hover:bg-[#ececef]'
                  }`}
                >
                  {cta}
                </Link>
              </TiltCard>
            </Reveal>
          ))}
        </div>

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
