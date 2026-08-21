"use client";

import { useEffect, useRef } from "react";
import { m, useScroll, useTransform } from "framer-motion";
import Link from "next/link";
import { ArrowRight } from "lucide-react";

export function BrutalistHero() {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start start", "end start"],
  });

  const textY = useTransform(scrollYProgress, [0, 1], ["0%", "50%"]);
  const opacity = useTransform(scrollYProgress, [0, 0.5], [1, 0]);

  return (
    <div ref={containerRef} className="relative w-full h-[150vh] bg-[#050505] overflow-x-hidden selection:bg-red-500 selection:text-white">
      
      {/* 1. Fluid Spatial Background */}
      <div className="fixed inset-0 w-full h-full pointer-events-none z-0 overflow-hidden opacity-80">
        {/* Animated Gradient Mesh */}
        <m.div
          animate={{
            scale: [1, 1.2, 1],
            x: ["0%", "5%", "0%"],
            y: ["0%", "-5%", "0%"],
            rotate: [0, 10, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "linear" }}
          className="absolute -top-[20%] -left-[10%] w-[70vw] h-[70vw] rounded-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-zinc-800/40 via-zinc-900/10 to-transparent blur-[120px] mix-blend-screen"
        />
        <m.div
          animate={{
            scale: [1, 1.5, 1],
            x: ["0%", "-10%", "0%"],
            y: ["0%", "10%", "0%"],
            rotate: [0, -15, 0]
          }}
          transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          className="absolute top-[40%] -right-[20%] w-[80vw] h-[80vw] rounded-full bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-red-900/20 via-black/10 to-transparent blur-[150px] mix-blend-screen"
        />
        
        {/* Noise overlay for texture */}
        <div 
          className="absolute inset-0 opacity-[0.03]"
          style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg viewBox=%220 0 200 200%22 xmlns=%22http://www.w3.org/2000/svg%22%3E%3Cfilter id=%22noiseFilter%22%3E%3CfeTurbulence type=%22fractalNoise%22 baseFrequency=%220.65%22 numOctaves=%223%22 stitchTiles=%22stitch%22/%3E%3C/filter%3E%3Crect width=%22100%25%22 height=%22100%25%22 filter=%22url(%23noiseFilter)%22/%3E%3C/svg%3E")' }}
        />
      </div>

      {/* 2. Massive Brutalist Typography (Pinned in the first viewport) */}
      <div className="sticky top-0 w-full h-screen flex flex-col justify-center px-4 md:px-12 z-10">
        
        <m.div style={{ y: textY, opacity }} className="max-w-[1400px] mx-auto w-full">
          {/* Super Fast 10-Second Value Prop */}
          <div className="overflow-hidden mb-4">
            <m.p 
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
              className="text-red-500 font-mono text-sm md:text-lg font-bold tracking-widest uppercase mb-4"
            >
              [ The Document Evolution ]
            </m.p>
          </div>

          <h1 className="font-display font-black text-white text-[12vw] leading-[0.85] tracking-tighter uppercase mix-blend-difference">
            <m.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.1, ease: [0.16, 1, 0.3, 1] }}
              className="block line-through decoration-red-600 decoration-[0.5rem] md:decoration-[1.5rem] opacity-50"
            >
              DEAD PDFs.
            </m.div>
            <m.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2, ease: [0.16, 1, 0.3, 1] }}
              className="block"
            >
              LIVING
            </m.div>
            <m.div 
              initial={{ opacity: 0, y: 50 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
              className="block text-transparent bg-clip-text bg-gradient-to-r from-white to-zinc-500"
            >
              DOCUMENTS.
            </m.div>
          </h1>

          <m.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="mt-12 md:mt-24 max-w-2xl"
          >
            <p className="text-zinc-400 text-xl md:text-3xl font-medium leading-tight">
              Turn static files into interactive, trackable experiences instantly. Understand your readers in <span className="text-white">less than 10 seconds.</span>
            </p>
            
            {/* Extremely clear, high-conversion CTA */}
            <div className="mt-12 flex flex-col sm:flex-row gap-6 items-start sm:items-center">
              <Link 
                href="/create"
                className="group relative inline-flex items-center justify-center px-10 py-5 bg-white text-black font-bold text-lg rounded-full overflow-hidden transition-transform hover:scale-105 active:scale-95"
              >
                <div className="absolute inset-0 w-full h-full bg-red-600 transform scale-x-0 origin-left group-hover:scale-x-100 transition-transform duration-300 ease-out" />
                <span className="relative flex items-center gap-2 group-hover:text-white transition-colors duration-300">
                  Try QLICO Now 
                  <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                </span>
              </Link>
              
              <p className="text-sm text-zinc-500 font-mono">
                No credit card required. <br/> Free forever plan available.
              </p>
            </div>
          </m.div>
        </m.div>

        {/* Scroll Indicator */}
        <m.div 
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 1.5, duration: 1 }}
          className="absolute bottom-12 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2"
        >
          <span className="text-xs font-mono text-zinc-500 tracking-widest uppercase">Scroll</span>
          <div className="w-[1px] h-12 bg-gradient-to-b from-zinc-500 to-transparent" />
        </m.div>

      </div>
    </div>
  );
}
