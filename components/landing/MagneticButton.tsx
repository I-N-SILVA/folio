'use client'

import { useRef, type ReactNode } from 'react'
import Link from 'next/link'
import { motion, useMotionValue, useReducedMotion, useSpring } from 'framer-motion'

const MotionLink = motion.create(Link)

type Props = {
  href: string
  children: ReactNode
  className?: string
  /** How far the button drifts toward the cursor, in px. */
  strength?: number
  onClick?: () => void
}

/** A primary CTA that subtly leans toward the cursor. */
export function MagneticButton({ href, children, className = '', strength = 6, onClick }: Props) {
  const ref = useRef<HTMLAnchorElement>(null)
  const reduce = useReducedMotion()
  const x = useSpring(useMotionValue(0), { stiffness: 200, damping: 15 })
  const y = useSpring(useMotionValue(0), { stiffness: 200, damping: 15 })

  function onMove(e: React.MouseEvent) {
    if (reduce || !ref.current) return
    const r = ref.current.getBoundingClientRect()
    const px = (e.clientX - (r.left + r.width / 2)) / (r.width / 2)
    const py = (e.clientY - (r.top + r.height / 2)) / (r.height / 2)
    x.set(px * strength)
    y.set(py * strength)
  }

  function reset() {
    x.set(0)
    y.set(0)
  }

  return (
    <MotionLink
      ref={ref}
      href={href}
      className={className}
      style={{ x, y }}
      onMouseMove={onMove}
      onMouseLeave={reset}
      onClick={onClick}
      whileTap={{ scale: 0.97 }}
    >
      {children}
    </MotionLink>
  )
}
