'use client'

import { useRef } from 'react'
import { motion, useScroll, useTransform, useSpring } from 'framer-motion'
import Reveal from './Reveal'

const STEPS = [
  ['01', 'Compose', 'Start from a static PDF or build page-by-page with modular blocks. Everything remains perfectly crisp.'],
  ['02', 'Enrich', 'Add rich interactive hotspots, lead generation gates, custom themes, and embedded media directly onto the page.'],
  ['03', 'Publish', 'Share a fast, hosted reader, embed it seamlessly into your site, and measure every interaction and read-through.'],
]

export function HowItWorks() {
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ['start center', 'end center']
  })

  // Smooth out the scroll progress for a buttery feel
  const smoothProgress = useSpring(scrollYProgress, { stiffness: 100, damping: 30, restDelta: 0.001 })
  const lineHeight = useTransform(smoothProgress, [0, 1], ['0%', '100%'])

  return (
    <section id="how" className="relative bg-[var(--background-alt)] px-5 py-32 sm:py-48">
      <div ref={containerRef} className="mx-auto max-w-5xl grid grid-cols-1 md:grid-cols-[1fr_1.2fr] gap-16 md:gap-8 relative">
        
        {/* Sticky Left Column */}
        <div className="md:sticky md:top-48 md:h-fit z-10">
          <Reveal>
            <h2 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl lg:text-6xl text-[var(--qlico-ink)]">
              From flat file<br />to living edition.
            </h2>
            <p className="mt-6 text-lg leading-relaxed text-[var(--qlico-muted)] max-w-md">
              QLICO isn't just a viewer. It's a publishing pipeline that adds depth, interactivity, and measurement to every document.
            </p>
          </Reveal>
        </div>

        {/* Scrolling Right Column with Vertical Path */}
        <div className="relative pl-10 sm:pl-16">
          {/* Track background */}
          <div className="absolute left-[3px] top-8 bottom-8 w-[2px] rounded-full bg-[var(--qlico-border)] sm:left-4" />
          
          {/* Tracing Vermilion line */}
          <motion.div 
            className="absolute left-[3px] top-8 w-[2px] rounded-full bg-[var(--accent)] origin-top sm:left-4 z-10" 
            style={{ 
              height: lineHeight,
              boxShadow: '0 0 16px var(--accent-fg)'
            }}
          />

          <div className="flex flex-col gap-32">
            {STEPS.map(([num, title, desc], i) => (
              <Reveal key={num} delay={0}>
                <div className="relative">
                  {/* Glowing Node */}
                  <div className="absolute -left-10 sm:-left-16 top-0 flex h-8 w-8 items-center justify-center">
                    <motion.div 
                      className="absolute inset-0 rounded-full bg-[var(--accent)]"
                      style={{
                        scale: useTransform(smoothProgress, [i * 0.33, (i * 0.33) + 0.1], [0, 1]),
                        opacity: useTransform(smoothProgress, [i * 0.33, (i * 0.33) + 0.1], [0, 0.2]),
                        filter: 'blur(8px)'
                      }}
                    />
                    <motion.div 
                      className="h-3 w-3 rounded-full bg-[var(--qlico-paper)] border-[2px] border-[var(--qlico-border)] z-20 relative transition-colors duration-300"
                      style={{
                        borderColor: useTransform(smoothProgress, [i * 0.33, (i * 0.33) + 0.1], ['var(--qlico-border)', 'var(--accent)']) as any
                      }}
                    />
                  </div>
                  
                  <span className="font-display text-3xl font-semibold text-[var(--accent-fg)] opacity-80">{num}</span>
                  <h3 className="mt-4 text-2xl font-semibold tracking-[-0.01em] text-[var(--qlico-ink)]">{title}</h3>
                  <p className="mt-3 text-[16px] leading-8 text-[var(--qlico-muted)] max-w-sm">{desc}</p>
                </div>
              </Reveal>
            ))}
          </div>
        </div>

      </div>
    </section>
  )
}
