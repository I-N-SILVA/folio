'use client'

import Link from 'next/link'
import { m, useReducedMotion } from 'framer-motion'
import { MagneticButton } from './MagneticButton'

function NeonGelBlobs() {
  const reduce = useReducedMotion()
  if (reduce) return null

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none z-0 flex justify-center items-center opacity-80 dark:opacity-60">
      {/* Magenta Blob */}
      <m.div
        animate={{
          scale: [1, 1.1, 1],
          x: [0, 40, 0],
          y: [0, -30, 0],
          rotate: [0, 45, 0]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[400px] h-[400px] rounded-[40%_60%_70%_30%] bg-fuchsia-500/50 mix-blend-multiply dark:mix-blend-screen filter blur-[80px]"
        style={{ top: '5%', left: '15%' }}
      />
      
      {/* Cyan Blob */}
      <m.div
        animate={{
          scale: [1, 1.2, 1],
          x: [0, -50, 0],
          y: [0, 50, 0],
          rotate: [0, -45, 0]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute w-[500px] h-[500px] rounded-[60%_40%_30%_70%] bg-cyan-400/50 mix-blend-multiply dark:mix-blend-screen filter blur-[100px]"
        style={{ top: '25%', right: '10%' }}
      />
      
      {/* Chartreuse Blob */}
      <m.div
        animate={{
          scale: [1, 1.1, 1],
          x: [0, 30, 0],
          y: [0, 30, 0],
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 4 }}
        className="absolute w-[350px] h-[350px] rounded-[50%_50%_40%_60%] bg-lime-400/50 mix-blend-multiply dark:mix-blend-screen filter blur-[70px]"
        style={{ bottom: '15%', left: '35%' }}
      />
    </div>
  )
}

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
            className="inline-block relative z-10"
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
      <NeonGelBlobs />
      
      <div className="mx-auto max-w-5xl relative z-10 pt-12">
        <HeadlineReveal
          text="Transform chaos into flow."
          className="font-display mx-auto max-w-4xl text-5xl font-bold leading-[1.05] tracking-[-0.04em] sm:text-7xl lg:text-[7.5rem] lg:leading-[0.92]"
        />
        <m.p 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.3, duration: 0.6 }}
          className="mx-auto mt-8 max-w-2xl text-xl font-medium text-[var(--qlico-muted)]"
        >
          Your documents, intelligent, organized, connected.
        </m.p>
        
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mt-14 flex justify-center relative z-20"
        >
          <MagneticButton
            href="/signup"
            className="rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-10 py-4 text-[17px] font-bold text-white shadow-[0_0_40px_rgba(217,70,239,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_60px_rgba(217,70,239,0.6)]"
          >
            Try QLICO Free
          </MagneticButton>
        </m.div>
      </div>

      <m.div 
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.6, duration: 1, ease: [0.16, 1, 0.3, 1] }}
        className="mx-auto mt-24 max-w-[1400px] relative z-20 px-4 sm:px-8" 
      >
        <div className="relative rounded-[2rem] p-2 bg-gradient-to-b from-white/40 to-white/10 dark:from-white/10 dark:to-white/5 backdrop-blur-md shadow-2xl border border-white/20">
          <img 
            src="/demo/editorial.jpg" 
            alt="QLICO Edition" 
            className="w-full h-auto rounded-[1.5rem] shadow-[var(--qlico-shadow)] object-cover"
          />
        </div>
      </m.div>
    </section>
  )
}
