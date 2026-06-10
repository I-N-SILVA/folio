'use client'

import { useEffect, useRef, useState, type ElementType, type ReactNode } from 'react'

type RevealProps = {
  children: ReactNode
  /** Stagger delay in milliseconds. */
  delay?: number
  /** Render as a different element (defaults to a div). */
  as?: ElementType
  className?: string
}

/**
 * Fades + lifts its children into view the first time they cross the viewport.
 * Pairs with the `.folio-reveal` / `.is-visible` classes in globals.css and
 * degrades gracefully when IntersectionObserver or motion is unavailable.
 */
export default function Reveal({ children, delay = 0, as, className = '' }: RevealProps) {
  const Tag = (as || 'div') as ElementType
  const ref = useRef<HTMLElement | null>(null)
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const node = ref.current
    if (!node) return

    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true)
      return
    }

    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true)
            observer.disconnect()
            break
          }
        }
      },
      { threshold: 0.16, rootMargin: '0px 0px -8% 0px' }
    )

    observer.observe(node)
    return () => observer.disconnect()
  }, [])

  return (
    <Tag
      ref={ref}
      className={`folio-reveal ${visible ? 'is-visible' : ''} ${className}`.trim()}
      style={delay ? { transitionDelay: `${delay}ms` } : undefined}
    >
      {children}
    </Tag>
  )
}
