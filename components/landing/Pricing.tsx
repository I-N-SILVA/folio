'use client'

import { useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import { Check, ArrowRight } from 'lucide-react'
import Reveal from './Reveal'

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    description: 'Publish something real and see who reads it.',
    features: [
      '3 Active Editions',
      'Instant PDF Import',
      '30 Days Analytics',
      'Tactile 3D Reader & Riffle',
      'Watermarked Reader',
    ],
    cta: 'Start Free',
    href: '/login',
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/mo',
    description: 'For creators whose editions have to bring something back.',
    features: [
      'Unlimited Editions',
      '365 Days Analytics',
      'Remove QLICO Badge',
      'Shoppable Hotspots (Stripe)',
      'Live Data Binding',
      'CSV Leads & Events Export',
    ],
    cta: 'Upgrade to Pro',
    href: '/login?next=%2Faccount',
  },
  {
    name: 'Lifetime',
    price: '$59',
    description: 'One-time payment or AppSumo code. Yours forever.',
    features: [
      'Everything in Pro',
      'Lifetime Updates',
      'Redeem AppSumo Code',
      'No Monthly Subscriptions',
      'Priority Creator Support',
    ],
    cta: 'Redeem or Get Lifetime',
    href: '/redeem',
  },
]

export function Pricing() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0) // Default to Free at top of scroll

  // Track scroll progress through this specific section
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start start', 'end end'],
  })

  // Map scroll progress (0 to 1) directly to dial rotation (-60deg to 60deg)
  const dialRotation = useTransform(scrollYProgress, [0, 0.5, 1], [-60, 0, 60])

  // Update the active pricing data based on scroll thresholds
  useMotionValueEvent(scrollYProgress, 'change', (latest) => {
    if (latest < 0.33) {
      if (activeIndex !== 0) setActiveIndex(0)
    } else if (latest >= 0.33 && latest < 0.66) {
      if (activeIndex !== 1) setActiveIndex(1)
    } else {
      if (activeIndex !== 2) setActiveIndex(2)
    }
  })

  const scrollToTier = (tierIndex: number) => {
    setActiveIndex(tierIndex)
    if (!containerRef.current) return
    const containerTop = containerRef.current.offsetTop
    const containerHeight = containerRef.current.offsetHeight
    const targetScroll = containerTop + (tierIndex / 2) * (containerHeight - window.innerHeight)
    window.scrollTo({ top: targetScroll, behavior: 'smooth' })
  }

  const activePlan = PLANS[activeIndex]

  return (
    <section ref={containerRef} id="pricing" className="relative h-[300vh] bg-[#050505]">
      {/* Sticky viewport that stays fixed while scrolling the 300vh container */}
      <div className="sticky top-0 flex h-screen w-full items-center overflow-hidden">
        {/* Ambient background light */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 h-[800px] w-[800px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-white/5 blur-[120px]" />

        <div className="relative z-10 mx-auto flex w-full max-w-5xl flex-col items-center gap-4 px-5 sm:gap-16 md:flex-row md:gap-24">
          {/* Left Side: The Vault Dial */}
          <div className="flex flex-1 flex-col items-center">
            <Reveal>
              <h2 className="font-display mb-2 text-center text-3xl font-medium tracking-tight text-white sm:text-5xl">
                Unlock Power.
              </h2>
              <p className="mb-6 text-center text-sm text-zinc-400 md:mb-16 md:text-base">
                Scroll or click labels to explore tiers.
              </p>
            </Reveal>

            <div className="relative flex h-48 w-48 items-center justify-center sm:h-96 sm:w-96">
              {/* Dial background / track */}
              <div className="absolute inset-0 rounded-full border border-white/10 bg-black/50 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]" />

              {/* Interactive Position Indicators */}
              <button
                type="button"
                onClick={() => scrollToTier(1)}
                className="absolute -top-8 text-xs font-medium uppercase tracking-widest text-zinc-500 transition-colors duration-300 hover:text-zinc-300"
                style={{ color: activeIndex === 1 ? 'white' : undefined }}
              >
                Pro
              </button>
              <button
                type="button"
                onClick={() => scrollToTier(0)}
                className="absolute -left-8 top-[80%] text-xs font-medium uppercase tracking-widest text-zinc-500 transition-colors duration-300 hover:text-zinc-300"
                style={{ color: activeIndex === 0 ? 'white' : undefined }}
              >
                Free
              </button>
              <button
                type="button"
                onClick={() => scrollToTier(2)}
                className="absolute -right-12 top-[80%] text-xs font-medium uppercase tracking-widest text-zinc-500 transition-colors duration-300 hover:text-zinc-300"
                style={{ color: activeIndex === 2 ? 'white' : undefined }}
              >
                Lifetime
              </button>

              {/* The Rotatable Dial (Driven purely by scroll physics) */}
              <motion.div
                style={{ rotate: dialRotation }}
                className="relative z-10 flex h-40 w-40 items-center justify-center rounded-full border border-zinc-600/50 bg-gradient-to-br from-zinc-700 via-zinc-900 to-black shadow-[0_0_80px_rgba(255,255,255,0.05),inset_0_2px_10px_rgba(255,255,255,0.2)] sm:h-[20rem] sm:w-[20rem]"
              >
                {/* Inner details for realism */}
                <div className="flex h-[85%] w-[85%] items-center justify-center rounded-full border border-black/80 bg-gradient-to-tl from-zinc-800 to-zinc-950 shadow-[inset_0_0_30px_rgba(0,0,0,1)]">
                  <div className="h-1/2 w-1/2 rounded-full border border-white/5 bg-black shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)]" />
                </div>

                {/* The Notch (points to active plan) */}
                <div className="absolute left-1/2 top-4 h-6 w-2 -translate-x-1/2 rounded-full bg-white shadow-[0_0_15px_rgba(255,255,255,0.8)]" />

                {/* Grip lines */}
                <div className="pointer-events-none absolute inset-0">
                  {[...Array(36)].map((_, i) => (
                    <div
                      key={i}
                      className="absolute inset-0"
                      style={{ transform: `rotate(${i * 10}deg)` }}
                    >
                      <div className="absolute left-1/2 top-[2px] h-3 w-[2px] -translate-x-1/2 bg-white/10 sm:top-[4px] sm:h-5" />
                    </div>
                  ))}
                </div>
              </motion.div>
            </div>
          </div>

          {/* Right Side: The Data Reveal */}
          <div className="relative min-h-[380px] w-full max-w-md flex-1 sm:min-h-[500px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -40, scale: 0.95 }}
                transition={{ duration: 0.4, type: 'spring', bounce: 0 }}
                className="absolute inset-0 flex flex-col rounded-[2rem] border border-white/10 bg-black/40 p-6 shadow-[0_0_100px_rgba(255,255,255,0.03)] backdrop-blur-2xl sm:rounded-[2.5rem] sm:p-10"
              >
                <div className="pointer-events-none absolute inset-0 rounded-[2rem] bg-gradient-to-b from-white/5 to-transparent opacity-50 sm:rounded-[2.5rem]" />

                <div className="relative z-10 flex h-full flex-col">
                  <h3 className="font-display text-2xl font-medium tracking-tight text-white sm:text-3xl">
                    {activePlan.name}
                  </h3>
                  <p className="mt-2 text-[12px] leading-tight text-zinc-400 sm:mt-3 sm:h-10 sm:text-sm">
                    {activePlan.description}
                  </p>

                  <div className="mt-4 flex items-baseline gap-1 sm:mt-8">
                    <span className="font-display text-4xl font-medium tracking-tight text-white sm:text-6xl">
                      {activePlan.price}
                    </span>
                    {activePlan.period && (
                      <span className="font-medium text-zinc-500">{activePlan.period}</span>
                    )}
                  </div>

                  <div className="my-4 h-px w-full bg-white/10 sm:my-10" />

                  <ul className="flex-1 space-y-5">
                    {activePlan.features.map((feature, idx) => (
                      <motion.li
                        key={feature}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + idx * 0.1 }}
                        className="flex items-center gap-3 text-[13px] text-zinc-300 sm:gap-4 sm:text-[16px]"
                      >
                        <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-white text-black sm:h-6 sm:w-6">
                          <Check size={14} strokeWidth={3} />
                        </div>
                        {feature}
                      </motion.li>
                    ))}
                  </ul>

                  <Link
                    href={activePlan.href}
                    className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-white py-3 text-center text-[14px] font-semibold text-black transition-all hover:scale-[1.02] hover:bg-zinc-200 active:scale-[0.98] sm:mt-12 sm:py-5 sm:text-[16px]"
                  >
                    <span>{activePlan.cta}</span>
                    <ArrowRight size={16} />
                  </Link>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>
        </div>
      </div>
    </section>
  )
}
