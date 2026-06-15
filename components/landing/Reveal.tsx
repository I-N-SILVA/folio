'use client'

import { type ElementType, type ReactNode } from 'react'
import { motion, useReducedMotion, type Variants } from 'framer-motion'

type RevealProps = {
  children: ReactNode
  /** Stagger delay in milliseconds. */
  delay?: number
  /** Render as a different motion element (defaults to a div). */
  as?: ElementType
  className?: string
}

/**
 * Fades + lifts its children into view the first time they cross the viewport,
 * using a spring for a premium, organic settle. Honors reduced-motion.
 */
export default function Reveal({ children, delay = 0, as, className = '' }: RevealProps) {
  const reduce = useReducedMotion()
  const MotionTag = (motion as any)[(as as string) || 'div'] as ElementType

  const variants: Variants = {
    hidden: { opacity: 0, y: reduce ? 0 : 26 },
    show: {
      opacity: 1,
      y: 0,
      transition: reduce
        ? { duration: 0.2 }
        : { type: 'spring', stiffness: 120, damping: 20, mass: 0.6, delay: delay / 1000 },
    },
  }

  return (
    <MotionTag
      className={className}
      variants={variants}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.2, margin: '0px 0px -8% 0px' }}
    >
      {children}
    </MotionTag>
  )
}
