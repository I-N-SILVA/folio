'use client'

import { useRef, useState } from 'react'
import { motion, AnimatePresence, useScroll, useTransform, useMotionValueEvent } from 'framer-motion'
import { Check } from 'lucide-react'
import Reveal from './Reveal'

const PLANS = [
  {
    name: 'Free',
    price: '$0',
    description: 'For individuals exploring digital publishing.',
    features: ['1 Edition', 'Watermarked Reader', 'Basic Analytics', 'Community Support'],
    cta: 'Start Free',
  },
  {
    name: 'Pro',
    price: '$19',
    period: '/mo',
    description: 'For professionals building their brand.',
    features: ['Unlimited Editions', 'Custom Branding', 'Advanced Analytics', 'Shoppable Pages', 'Priority Support'],
    cta: 'Upgrade to Pro',
  },
  {
    name: 'Lifetime',
    price: '$59',
    description: 'One time payment. Yours forever.',
    features: ['Everything in Pro', 'Lifetime Updates', 'No Monthly Fees', 'Early Access Features'],
    cta: 'Get Lifetime',
  },
]

export function Pricing() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [activeIndex, setActiveIndex] = useState(0) // Default to Free at top of scroll

  // Track scroll progress through this specific section
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  })

  // Map scroll progress (0 to 1) directly to dial rotation (-60deg to 60deg)
  const dialRotation = useTransform(scrollYProgress, [0, 0.5, 1], [-60, 0, 60])

  // Update the active pricing data based on scroll thresholds
  useMotionValueEvent(scrollYProgress, "change", (latest) => {
    if (latest < 0.33) {
      if (activeIndex !== 0) setActiveIndex(0)
    } else if (latest >= 0.33 && latest < 0.66) {
      if (activeIndex !== 1) setActiveIndex(1)
    } else {
      if (activeIndex !== 2) setActiveIndex(2)
    }
  })

  const activePlan = PLANS[activeIndex]

  return (
    <section ref={containerRef} id="pricing" className="bg-[#050505] relative h-[300vh]">
      
      {/* Sticky viewport that stays fixed while scrolling the 300vh container */}
      <div className="sticky top-0 h-screen w-full flex items-center overflow-hidden">
        
        {/* Ambient background light */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[800px] h-[800px] bg-white/5 rounded-full blur-[120px] pointer-events-none" />

        <div className="relative z-10 mx-auto max-w-5xl w-full px-5 flex flex-col md:flex-row items-center gap-4 sm:gap-16 md:gap-24">
          
          {/* Left Side: The Vault Dial */}
          <div className="flex-1 flex flex-col items-center">
            <Reveal>
              <h2 className="font-display text-3xl font-medium tracking-tight sm:text-5xl text-white mb-2 text-center">
                Unlock Power.
              </h2>
              <p className="text-zinc-400 text-center text-sm md:text-base mb-6 md:mb-16">
                Scroll to explore tiers.
              </p>
            </Reveal>

            <div className="relative w-48 h-48 sm:w-96 sm:h-96 flex items-center justify-center">
              {/* Dial background / track */}
              <div className="absolute inset-0 rounded-full border border-white/10 bg-black/50 shadow-[inset_0_0_50px_rgba(0,0,0,0.8)]" />
              
              {/* Position Indicators */}
              <div className="absolute -top-8 text-xs font-medium tracking-widest text-zinc-500 uppercase transition-colors duration-300" style={{ color: activeIndex === 1 ? 'white' : '' }}>Pro</div>
              <div className="absolute top-[80%] -left-8 text-xs font-medium tracking-widest text-zinc-500 uppercase transition-colors duration-300" style={{ color: activeIndex === 0 ? 'white' : '' }}>Free</div>
              <div className="absolute top-[80%] -right-12 text-xs font-medium tracking-widest text-zinc-500 uppercase transition-colors duration-300" style={{ color: activeIndex === 2 ? 'white' : '' }}>Lifetime</div>

              {/* The Rotatable Dial (Driven purely by scroll physics) */}
              <motion.div
                style={{ rotate: dialRotation }}
                className="relative w-40 h-40 sm:w-[20rem] sm:h-[20rem] rounded-full shadow-[0_0_80px_rgba(255,255,255,0.05),inset_0_2px_10px_rgba(255,255,255,0.2)] bg-gradient-to-br from-zinc-700 via-zinc-900 to-black flex items-center justify-center z-10 border border-zinc-600/50"
              >
                {/* Inner details for realism */}
                <div className="w-[85%] h-[85%] rounded-full border border-black/80 bg-gradient-to-tl from-zinc-800 to-zinc-950 flex items-center justify-center shadow-[inset_0_0_30px_rgba(0,0,0,1)]">
                  <div className="w-1/2 h-1/2 rounded-full border border-white/5 bg-black shadow-[inset_0_2px_10px_rgba(255,255,255,0.05)]" />
                </div>
                
                {/* The Notch (points to active plan) */}
                <div className="absolute top-4 left-1/2 -translate-x-1/2 w-2 h-6 bg-white rounded-full shadow-[0_0_15px_rgba(255,255,255,0.8)]" />
                
                {/* Grip lines */}
                {[...Array(36)].map((_, i) => (
                  <div 
                    key={i}
                    className="absolute w-[2px] h-3 bg-white/10"
                    style={{
                      top: '2px',
                      left: '50%',
                      transformOrigin: '50% calc(50% + 4.5rem)', 
                      transform: `translateX(-50%) rotate(${i * 10}deg)`
                    }}
                  />
                ))}
              </motion.div>
            </div>
          </div>

          {/* Right Side: The Data Reveal */}
          <div className="flex-1 w-full max-w-md relative min-h-[380px] sm:min-h-[500px]">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeIndex}
                initial={{ opacity: 0, y: 40, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -40, scale: 0.95 }}
                transition={{ duration: 0.4, type: "spring", bounce: 0 }}
                className="absolute inset-0 flex flex-col p-6 sm:p-10 rounded-[2rem] sm:rounded-[2.5rem] bg-black/40 backdrop-blur-2xl border border-white/10 shadow-[0_0_100px_rgba(255,255,255,0.03)]"
              >
                <div className="absolute inset-0 rounded-[2rem] sm:rounded-[2.5rem] bg-gradient-to-b from-white/5 to-transparent opacity-50 pointer-events-none" />

                <div className="relative z-10 flex flex-col h-full">
                  <h3 className="font-display text-2xl sm:text-3xl font-medium tracking-tight text-white">{activePlan.name}</h3>
                  <p className="mt-2 sm:mt-3 text-[12px] sm:text-sm text-zinc-400 sm:h-10 leading-tight">{activePlan.description}</p>
                  
                  <div className="mt-4 sm:mt-8 flex items-baseline gap-1">
                    <span className="font-display text-4xl sm:text-6xl font-medium tracking-tight text-white">{activePlan.price}</span>
                    {activePlan.period && <span className="text-zinc-500 font-medium">{activePlan.period}</span>}
                  </div>
                  
                  <div className="w-full h-px bg-white/10 my-4 sm:my-10" />
                  
                  <ul className="space-y-5 flex-1">
                    {activePlan.features.map((feature, idx) => (
                      <motion.li 
                        key={feature} 
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.2 + (idx * 0.1) }}
                        className="flex items-center gap-3 sm:gap-4 text-[13px] sm:text-[16px] text-zinc-300"
                      >
                        <div className="flex h-5 w-5 sm:h-6 sm:w-6 items-center justify-center rounded-full bg-white text-black shrink-0">
                          <Check size={14} strokeWidth={3} />
                        </div>
                        {feature}
                      </motion.li>
                    ))}
                  </ul>

                  <button
                    className="mt-6 sm:mt-12 w-full rounded-full py-3 sm:py-5 text-[14px] sm:text-[16px] font-medium bg-white text-black transition-all hover:scale-[1.02] active:scale-[0.98] hover:bg-zinc-200"
                  >
                    {activePlan.cta}
                  </button>
                </div>
              </motion.div>
            </AnimatePresence>
          </div>

        </div>
      </div>
    </section>
  )
}
