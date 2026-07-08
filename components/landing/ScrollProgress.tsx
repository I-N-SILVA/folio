'use client'

import { m, useScroll, useSpring } from 'framer-motion'

export function ScrollProgress() {
  const { scrollYProgress } = useScroll()
  const scaleX = useSpring(scrollYProgress, { stiffness: 120, damping: 30, mass: 0.3 })
  return <m.div style={{ scaleX }} className="fixed inset-x-0 top-0 z-[60] h-0.5 origin-left bg-[var(--accent)]" />
}
