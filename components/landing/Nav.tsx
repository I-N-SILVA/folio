'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'

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
      className={`fixed inset-x-0 top-4 z-50 transition-all duration-500 flex justify-center px-4`}
    >
      <div 
        className={`flex h-14 items-center justify-between px-6 transition-all duration-500 rounded-full border ${
          scrolled
            ? 'w-[95%] max-w-5xl bg-black/60 backdrop-blur-2xl border-white/10 shadow-[0_0_30px_rgba(0,0,0,0.5)]'
            : 'w-full max-w-7xl bg-transparent border-transparent'
        }`}
      >
        <Link href="/" className="flex items-center" aria-label="QLICO home">
          <Image src="/brand/logo-dark.svg" alt="QLICO" width={100} height={25} priority className="h-6 w-auto" />
        </Link>
        
        <nav className="hidden items-center gap-8 text-[14px] font-medium tracking-wide text-zinc-400 md:flex">
          <Link href="#features" className="transition-colors hover:text-white">Features</Link>
          <Link href="#pricing" className="transition-colors hover:text-white">Pricing</Link>
          <Link href="#faq" className="transition-colors hover:text-white">FAQ</Link>
          <Link href="/book/demo" className="transition-colors hover:text-white">Demo</Link>
        </nav>
        
        <div className="flex items-center gap-3">
          <Link href="/login" className="hidden px-5 py-2 rounded-full border border-transparent text-[14px] font-medium text-white transition-colors hover:bg-white/10 sm:block">
            Sign in
          </Link>
          <Link href="/login" className="px-5 py-2 rounded-full border border-white/20 bg-white/5 text-[14px] font-medium text-white shadow-sm transition-all hover:scale-105 active:scale-[0.98] hover:bg-white hover:text-black">
            Get started
          </Link>
        </div>
      </div>
    </header>
  )
}
