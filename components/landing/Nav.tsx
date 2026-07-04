'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Mark } from './Mark'

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <header
      className={`fixed inset-x-0 top-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'border-b border-[var(--qlico-hairline)] bg-white/60 backdrop-blur-2xl shadow-[0_4px_30px_rgba(0,0,0,0.06)]'
          : 'border-b border-transparent bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-5">
        <Link href="/" className="flex items-center" aria-label="QLICO home">
          <Mark className="h-7 w-auto" />
        </Link>
        <nav className="hidden items-center gap-8 text-[13px] font-medium text-[var(--qlico-muted)] md:flex">
          <Link href="#features" className="transition hover:text-[var(--qlico-ink)]">Features</Link>
          <Link href="#how" className="transition hover:text-[var(--qlico-ink)]">How it works</Link>
          <Link href="#pricing" className="transition hover:text-[var(--qlico-ink)]">Pricing</Link>
          <Link href="/book/demo" className="transition hover:text-[var(--qlico-ink)]">Demo</Link>
        </nav>
        <div className="flex items-center gap-2">
          <Link href="/login" className="hidden rounded-full px-4 py-1.5 text-[13px] font-medium text-[var(--qlico-ink)] transition hover:bg-black/5 active:scale-[0.97] sm:block">
            Sign in
          </Link>
          <Link href="/login" className="rounded-full bg-[var(--accent)] px-4 py-1.5 text-[13px] font-semibold text-white transition hover:bg-[var(--accent-hover)] active:scale-[0.97]">
            Get started
          </Link>
        </div>
      </div>
    </header>
  )
}
