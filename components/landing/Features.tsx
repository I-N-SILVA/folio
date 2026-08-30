'use client'

import { useRef, useState } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Check } from 'lucide-react'

export function Features() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [addedToBag, setAddedToBag] = useState(false)
  
  // Track scroll progress within this container (which is 400vh tall)
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end end"]
  })

  // Center Magazine animations
  // It starts scaled down and rotated, then comes into focus
  const magazineScale = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.8, 1, 1, 0.8])
  const magazineRotateX = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [30, 0, 0, 30])
  const magazineY = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [100, 0, 0, -100])

  // Feature 1: Shoppable (0.2 to 0.4)
  const f1Opacity = useTransform(scrollYProgress, [0.15, 0.25, 0.35, 0.45], [0, 1, 1, 0])
  const f1Y = useTransform(scrollYProgress, [0.15, 0.25, 0.35, 0.45], [50, 0, 0, -50])
  const f1Blur = useTransform(scrollYProgress, [0.15, 0.25, 0.35, 0.45], ["blur(10px)", "blur(0px)", "blur(0px)", "blur(10px)"])

  // Feature 2: Live Data (0.4 to 0.6)
  const f2Opacity = useTransform(scrollYProgress, [0.35, 0.45, 0.55, 0.65], [0, 1, 1, 0])
  const f2Y = useTransform(scrollYProgress, [0.35, 0.45, 0.55, 0.65], [50, 0, 0, -50])
  const f2Blur = useTransform(scrollYProgress, [0.35, 0.45, 0.55, 0.65], ["blur(10px)", "blur(0px)", "blur(0px)", "blur(10px)"])

  // Feature 3: Analytics (0.6 to 0.8)
  const f3Opacity = useTransform(scrollYProgress, [0.55, 0.65, 0.75, 0.85], [0, 1, 1, 0])
  const f3Y = useTransform(scrollYProgress, [0.55, 0.65, 0.75, 0.85], [50, 0, 0, -50])
  const f3Blur = useTransform(scrollYProgress, [0.55, 0.65, 0.75, 0.85], ["blur(10px)", "blur(0px)", "blur(0px)", "blur(10px)"])

  // UI overlays on the magazine for each feature
  // F1: A checkout hotspot pulses
  const hotspotOpacity = useTransform(scrollYProgress, [0.2, 0.25, 0.35, 0.4], [0, 1, 1, 0])
  const hotspotScale = useTransform(scrollYProgress, [0.2, 0.25, 0.35, 0.4], [0.8, 1, 1, 0.8])
  
  // F2: Price tags updating
  const dataOverlayOpacity = useTransform(scrollYProgress, [0.4, 0.45, 0.55, 0.6], [0, 1, 1, 0])
  
  // F3: Heatmap glow
  const heatmapOpacity = useTransform(scrollYProgress, [0.6, 0.65, 0.75, 0.8], [0, 1, 1, 0])

  return (
    <section ref={containerRef} className="relative h-[400vh] bg-[#050505]">
      {/* Sticky container that stays in view while scrolling down the 400vh */}
      <div className="sticky top-0 h-screen w-full overflow-hidden flex items-center justify-center perspective-1000">
        
        {/* Ambient background light */}
        <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none">
          <div className="w-[1000px] h-[1000px] rounded-full bg-white/5 blur-[150px]" />
        </div>

        {/* --- LEFT TEXT FEATURES --- */}
        <div className="absolute top-12 md:top-0 md:left-[10%] w-full md:w-[350px] md:h-full flex items-start md:items-center justify-center z-20 pointer-events-none">
          <motion.div style={{ opacity: f1Opacity, y: f1Y, filter: f1Blur }} className="absolute px-6 md:px-0 text-center md:text-left">
            <h2 className="font-display text-4xl sm:text-5xl text-white mb-4 [text-shadow:0_4px_32px_rgba(0,0,0,1),_0_2px_8px_rgba(0,0,0,1)]">Shoppable Pages</h2>
            <p className="text-zinc-200 text-lg leading-relaxed [text-shadow:0_2px_16px_rgba(0,0,0,1),_0_1px_4px_rgba(0,0,0,1)] bg-black/40 md:bg-black/20 p-4 md:-ml-4 rounded-xl backdrop-blur-md border border-white/5">Embed rich checkouts and product tags directly onto the page. Your readers never have to leave the edition to buy.</p>
          </motion.div>
          
          <motion.div style={{ opacity: f3Opacity, y: f3Y, filter: f3Blur }} className="absolute px-6 md:px-0 text-center md:text-left">
            <h2 className="font-display text-4xl sm:text-5xl text-white mb-4 [text-shadow:0_4px_32px_rgba(0,0,0,1),_0_2px_8px_rgba(0,0,0,1)]">Deep Analytics</h2>
            <p className="text-zinc-200 text-lg leading-relaxed [text-shadow:0_2px_16px_rgba(0,0,0,1),_0_1px_4px_rgba(0,0,0,1)] bg-black/40 md:bg-black/20 p-4 md:-ml-4 rounded-xl backdrop-blur-md border border-white/5">Track exactly what they read, where they linger, and what they click. Export every event and captured email.</p>
          </motion.div>
        </div>

        {/* --- RIGHT TEXT FEATURES --- */}
        <div className="absolute bottom-12 md:bottom-0 md:top-0 md:right-[10%] w-full md:w-[350px] md:h-full flex items-end md:items-center justify-center z-20 pointer-events-none">
          <motion.div style={{ opacity: f2Opacity, y: f2Y, filter: f2Blur }} className="absolute px-6 md:px-0 text-center md:text-left">
            <h3 className="font-display text-4xl sm:text-5xl lg:text-6xl text-white [text-shadow:0_4px_32px_rgba(0,0,0,1),_0_2px_8px_rgba(0,0,0,1)]">Live Data</h3>
            <p className="mt-4 text-lg text-zinc-200 leading-relaxed [text-shadow:0_2px_16px_rgba(0,0,0,1),_0_1px_4px_rgba(0,0,0,1)] bg-black/40 md:bg-black/20 p-4 md:-ml-4 rounded-xl backdrop-blur-md border border-white/5">Bind text to external APIs. When your inventory drops or a price changes, the edition updates instantly. Publish once, stay current forever.</p>
          </motion.div>
        </div>

        {/* --- CENTRAL 3D MAGAZINE --- */}
        <motion.div 
          style={{ 
            scale: magazineScale, 
            rotateX: magazineRotateX,
            y: magazineY,
            transformStyle: 'preserve-3d' 
          }}
          className="relative z-10 w-[90vw] md:w-[800px] h-[60vw] md:h-[500px] flex shadow-[0_0_100px_rgba(255,255,255,0.1)] rounded-sm overflow-hidden"
        >
          {/* Magazine Left Page */}
          <div className="w-1/2 h-full relative border-r border-black/10 bg-zinc-900">
            <img src="/assets/avant_garde_profile_1787420839793.jpg" className="absolute inset-0 w-full h-full object-cover opacity-90" alt="Editorial left" />
            <div className="absolute inset-0 bg-gradient-to-r from-black/60 to-transparent" />
            
            {/* Shoppable Hotspot (F1) */}
            <motion.div 
              style={{ opacity: hotspotOpacity, scale: hotspotScale }}
              className="absolute top-[40%] left-[10%] md:left-[30%] flex flex-col items-center gap-2 z-30"
            >
              <div className="w-6 h-6 md:w-8 md:h-8 rounded-full bg-white/20 backdrop-blur-md border border-white/40 flex items-center justify-center">
                <div className="w-1.5 h-1.5 md:w-2 md:h-2 rounded-full bg-white animate-pulse" />
              </div>
              <div className="bg-black/80 backdrop-blur-xl border border-white/20 rounded-lg p-2 md:p-3 w-36 md:w-48 shadow-2xl origin-top scale-75 md:scale-100 transition-all">
                <div className="w-full h-16 md:h-24 bg-zinc-800 rounded mb-2 overflow-hidden relative">
                  <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                  <span className="absolute bottom-1 left-2 text-[9px] font-mono text-zinc-300">Look 04</span>
                </div>
                <div className="text-white font-medium text-xs md:text-sm truncate">Oversized Trench</div>
                <div className="text-zinc-400 text-[10px] md:text-xs">$450 • In Stock</div>
                <button
                  type="button"
                  onClick={() => {
                    setAddedToBag(true)
                    setTimeout(() => setAddedToBag(false), 2500)
                  }}
                  className={`mt-2 w-full py-1.5 text-center text-[10px] md:text-xs font-semibold rounded flex items-center justify-center gap-1 transition-all ${
                    addedToBag
                      ? 'bg-emerald-500 text-black shadow-[0_0_12px_rgba(16,185,129,0.5)]'
                      : 'bg-white text-black hover:bg-zinc-200 active:scale-95'
                  }`}
                >
                  {addedToBag ? (
                    <>
                      <Check size={12} strokeWidth={3} />
                      <span>Added to Bag!</span>
                    </>
                  ) : (
                    <span>Add to Bag</span>
                  )}
                </button>
              </div>
            </motion.div>

            {/* Analytics Heatmap Overlay (F3) */}
            <motion.div 
              style={{ opacity: heatmapOpacity }}
              className="absolute inset-0 bg-gradient-to-tr from-orange-500/0 via-orange-500/20 to-orange-500/0 mix-blend-screen"
            />
          </div>

          {/* Magazine Right Page */}
          <div className="w-1/2 h-full relative bg-zinc-100">
            <div className="absolute inset-0 bg-gradient-to-l from-black/10 to-transparent z-10" />
            <div className="p-4 md:p-12 h-full flex flex-col justify-center">
              <h1 className="font-display text-2xl md:text-5xl text-black mb-2 md:mb-6 tracking-tight">The Fall<br/>Collection</h1>
              <p className="text-zinc-600 font-sans leading-relaxed text-[10px] md:text-sm hidden sm:block">
                Exploring the intersection of brutalist architecture and soft, flowing fabrics. This season is defined by sharp contrasts.
              </p>

              {/* Live Data Overlay (F2) */}
              <motion.div style={{ opacity: dataOverlayOpacity }} className="mt-4 md:mt-8 flex flex-col gap-2 md:gap-4">
                <div className="flex justify-between items-center border-b border-black/10 pb-1 md:pb-2">
                  <span className="text-zinc-500 text-[8px] md:text-xs uppercase tracking-widest font-medium">Release</span>
                  <span className="text-emerald-600 text-[10px] md:text-sm font-medium bg-emerald-600/10 px-1 md:px-2 py-0.5 rounded font-mono">LIVE NOW</span>
                </div>
                <div className="flex justify-between items-center border-b border-black/10 pb-1 md:pb-2">
                  <span className="text-zinc-500 text-[8px] md:text-xs uppercase tracking-widest font-medium">Stock</span>
                  <span className="text-black text-[10px] md:text-sm font-medium font-mono tabular-nums">
                    {/* Simulated live data changing */}
                    <motion.span
                      animate={{ opacity: [1, 0.5, 1] }}
                      transition={{ duration: 2, repeat: Infinity }}
                    >
                      142
                    </motion.span>
                  </span>
                </div>
              </motion.div>

              {/* Analytics Heatmap Overlay (F3) */}
              <motion.div 
                style={{ opacity: heatmapOpacity }}
                className="absolute inset-0 bg-gradient-to-bl from-blue-500/0 via-blue-500/10 to-blue-500/0 mix-blend-multiply pointer-events-none"
              />
            </div>
          </div>
          
          {/* Magazine binding shadow */}
          <div className="absolute top-0 bottom-0 left-1/2 -translate-x-1/2 w-4 bg-gradient-to-r from-black/40 via-transparent to-black/5 z-20 pointer-events-none" />
        </motion.div>

      </div>
    </section>
  )
}
