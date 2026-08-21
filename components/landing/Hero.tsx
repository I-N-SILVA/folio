'use client'

import Link from 'next/link'
import { m, useReducedMotion } from 'framer-motion'
import { MagneticButton } from './MagneticButton'

function NeonGelBlobs() {
  const reduce = useReducedMotion()
  if (reduce) return null

  // We use multiple layers of gradients and inset shadows to create a "3D gel" effect
  // instead of just flat blurred circles.
  return (
    <div className="absolute left-1/2 top-[40%] -translate-x-1/2 -translate-y-1/2 w-full max-w-[1200px] h-[800px] pointer-events-none z-0">
      {/* Magenta Blob */}
      <m.div
        animate={{
          scale: [1, 1.15, 1],
          rotate: [0, 90, 0],
          borderRadius: ["40% 60% 70% 30%", "50% 50% 30% 70%", "40% 60% 70% 30%"]
        }}
        transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        className="absolute w-[450px] h-[450px] opacity-90 mix-blend-multiply dark:mix-blend-screen"
        style={{
          top: '0%', left: '10%',
          background: 'radial-gradient(circle at 30% 30%, #ff00ff, #c026d3, transparent)',
          boxShadow: 'inset 20px 20px 60px rgba(255,255,255,0.5), inset -20px -20px 60px rgba(0,0,0,0.5)',
          filter: 'blur(30px) drop-shadow(0 20px 40px rgba(255,0,255,0.4))'
        }}
      />
      
      {/* Cyan Blob */}
      <m.div
        animate={{
          scale: [1, 1.2, 1],
          rotate: [0, -90, 0],
          borderRadius: ["60% 40% 30% 70%", "40% 60% 70% 30%", "60% 40% 30% 70%"]
        }}
        transition={{ duration: 15, repeat: Infinity, ease: "easeInOut", delay: 1 }}
        className="absolute w-[550px] h-[550px] opacity-90 mix-blend-multiply dark:mix-blend-screen"
        style={{
          bottom: '-10%', right: '5%',
          background: 'radial-gradient(circle at 70% 30%, #00ffff, #0891b2, transparent)',
          boxShadow: 'inset 20px 20px 60px rgba(255,255,255,0.5), inset -20px -20px 60px rgba(0,0,0,0.5)',
          filter: 'blur(40px) drop-shadow(0 20px 40px rgba(0,255,255,0.4))'
        }}
      />
      
      {/* Chartreuse Blob */}
      <m.div
        animate={{
          scale: [1, 1.1, 1],
          rotate: [0, 45, 0],
          borderRadius: ["50% 50% 40% 60%", "30% 70% 50% 50%", "50% 50% 40% 60%"]
        }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut", delay: 2 }}
        className="absolute w-[380px] h-[380px] opacity-90 mix-blend-multiply dark:mix-blend-screen"
        style={{
          top: '40%', left: '0%',
          background: 'radial-gradient(circle at 30% 70%, #a3e635, #65a30d, transparent)',
          boxShadow: 'inset 20px 20px 60px rgba(255,255,255,0.5), inset -20px -20px 60px rgba(0,0,0,0.5)',
          filter: 'blur(25px) drop-shadow(0 20px 40px rgba(163,230,53,0.4))'
        }}
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
    <section className="relative overflow-hidden px-5 pb-32 pt-24 text-center">
      {/* 1. Image and Blobs at the top */}
      <div className="relative mx-auto mt-16 max-w-[1100px] h-[500px] sm:h-[650px] flex items-center justify-center">
        <NeonGelBlobs />
        
        <m.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 1, ease: [0.16, 1, 0.3, 1] }}
          className="relative z-20 w-full max-w-[900px] px-4" 
        >
          {/* Glassmorphism container for the product image */}
          <div className="relative rounded-[2rem] p-3 bg-white/30 dark:bg-black/30 backdrop-blur-xl shadow-[0_20px_80px_rgba(0,0,0,0.1)] border border-white/40 dark:border-white/10">
            <img 
              src="/demo/editorial.jpg" 
              alt="QLICO App" 
              className="w-full h-auto rounded-[1.5rem] shadow-xl object-cover"
            />
          </div>
        </m.div>
      </div>

      {/* 2. Headline and Text below the image */}
      <div className="mx-auto max-w-5xl relative z-10 pt-16">
        <HeadlineReveal
          text="Transform chaos into flow. Your documents, intelligent, organized, connected."
          className="font-display mx-auto max-w-4xl text-4xl font-bold leading-[1.1] tracking-[-0.04em] sm:text-6xl lg:text-[6rem] lg:leading-[0.95]"
        />
        <m.p 
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4, duration: 0.6 }}
          className="mx-auto mt-8 max-w-2xl text-xl font-medium text-[var(--qlico-muted)]"
        >
          Unlock the power of your knowledge. QLICO makes document workflows seamless, intelligent, and collaborative.
        </m.p>
        
        {/* 3. CTA Buttons at the bottom */}
        <m.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5, duration: 0.6 }}
          className="mt-12 flex flex-col sm:flex-row justify-center items-center gap-4 relative z-20"
        >
          <MagneticButton
            href="/signup"
            className="rounded-full bg-gradient-to-r from-fuchsia-500 to-cyan-500 px-10 py-4 text-[17px] font-bold text-white shadow-[0_0_40px_rgba(217,70,239,0.4)] transition-all hover:scale-105 hover:shadow-[0_0_60px_rgba(217,70,239,0.6)]"
          >
            Try QLICO Free
          </MagneticButton>
          
          <MagneticButton
            href="/demo"
            className="rounded-full bg-transparent border-2 border-foreground px-10 py-3.5 text-[17px] font-bold text-foreground transition-all hover:bg-foreground hover:text-background"
          >
            Watch Demo
          </MagneticButton>
        </m.div>
      </div>
    </section>
  )
}
