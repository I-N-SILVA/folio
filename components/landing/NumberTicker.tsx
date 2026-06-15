'use client'

import { useEffect, useRef } from 'react'
import { animate, useInView, useReducedMotion } from 'framer-motion'

type Props = {
  value: number
  prefix?: string
  suffix?: string
  decimals?: number
  className?: string
}

/** Counts up to `value` the first time it scrolls into view. */
export function NumberTicker({ value, prefix = '', suffix = '', decimals = 0, className = '' }: Props) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true, amount: 0.6 })
  const reduce = useReducedMotion()

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const format = (n: number) =>
      `${prefix}${n.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`

    if (reduce || !inView) {
      el.textContent = format(reduce ? value : 0)
      return
    }

    const controls = animate(0, value, {
      duration: 1.4,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (latest) => {
        el.textContent = format(latest)
      },
    })
    return () => controls.stop()
  }, [inView, value, prefix, suffix, decimals, reduce])

  return <span ref={ref} className={className}>{`${prefix}0${suffix}`}</span>
}
