'use client'

import Link from 'next/link'
import { m, useReducedMotion } from 'framer-motion'
import { MagneticButton } from './MagneticButton'

function HeadlineReveal({ text, className = '' }: { text: string; className?: string }) {
  const reduce = useReducedMotion()
  const words = text.split(/(\s+|\n)/)
  return (
    <h1 className={className}>
      {words.map((w, i) => {
        if (w === '\n') return <br key={i} className="hidden sm:block" />
        if (w.trim() === '') return <span key={i}>&nbsp;</span>
        return (
          <m.span
            key={i}
            className="inline-block"
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 20, filter: 'blur(8px)' }}
            animate={reduce ? { opacity: 1 } : { opacity: 1, y: 0, filter: 'blur(0px)' }}
            transition={
              reduce
                ? { duration: 0.3 }
                : { type: 'spring', stiffness: 140, damping: 20, delay: 0.1 + (i * 0.04) }
            }
          >
            {w}
          </m.span>
        )
      })}
    </h1>
  )
}

export function Hero() {
  return (
    <section className="relative overflow-hidden px-5 pb-24 pt-32 text-center sm:pt-40">
      <div className="mx-auto max-w-5xl relative z-10 pt-12">
        <HeadlineReveal
          text="The intelligent document format."
          className="font-display mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-[-0.04em] sm:text-7xl lg:text-[7.5rem] lg:leading-[0.92]"
        />
        
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-14 flex justify-center"
        >
          <MagneticButton
            href="/signup"
            className="rounded-full bg-[var(--accent)] px-10 py-4 text-[17px] font-semibold text-[var(--accent-contrast)] shadow-xl transition-all hover:scale-105 hover:bg-[var(--accent-hover)]"
          >
            Get Started
          </MagneticButton>
        </m.div>
      </div>

      <m.div 
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mt-24 max-w-[1400px] z-10 px-4 sm:px-8" 
      >
        <img 
          src="/demo/editorial.jpg" 
          alt="QLICO Edition" 
          className="w-full h-auto rounded-[2rem] shadow-[var(--qlico-shadow)] border border-[var(--qlico-border)] object-cover"
        />
      </m.div>
    </section>
  )
}
