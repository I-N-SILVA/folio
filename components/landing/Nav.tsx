'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Menu, X, ArrowRight, PlayCircle } from 'lucide-react'
import { Mark } from './Mark'

/** One list, so the bar and the mobile sheet cannot drift apart. */
const LINKS = [
  { href: '#features', label: 'Features' },
  { href: '#pricing', label: 'Pricing' },
  { href: '#faq', label: 'FAQ' },
] as const

export function Nav() {
  const [scrolled, setScrolled] = useState(false)
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const toggleRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    onScroll()
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  const close = useCallback(() => setOpen(false), [])

  // Escape, and a tap anywhere outside. Every in-sheet link closes it too —
  // these are hash anchors, so there is no navigation event to close it for us
  // and the sheet would otherwise sit over the section it just scrolled to.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        close()
        toggleRef.current?.focus()
      }
    }
    const onPointer = (e: PointerEvent) => {
      const t = e.target as Node
      if (!panelRef.current?.contains(t) && !toggleRef.current?.contains(t)) close()
    }
    window.addEventListener('keydown', onKey)
    window.addEventListener('pointerdown', onPointer)
    return () => {
      window.removeEventListener('keydown', onKey)
      window.removeEventListener('pointerdown', onPointer)
    }
  }, [open, close])

  return (
    <header className="fixed inset-x-0 top-4 z-50 flex justify-center px-4">
      <div className="w-full max-w-7xl">
        <div
          className={`flex h-14 items-center justify-between rounded-full border px-4 transition-all duration-500 sm:px-6 ${
            scrolled || open
              ? 'mx-auto w-full max-w-5xl border-white/10 bg-black/60 shadow-[0_0_30px_rgba(0,0,0,0.5)] backdrop-blur-2xl'
              : 'w-full border-transparent bg-transparent'
          }`}
        >
          <Link href="/" className="tap-target flex items-center text-white" aria-label="QLICO home">
            <Mark size={22} wordClassName="text-lg" />
          </Link>

          <nav className="hidden items-center gap-8 text-[14px] font-medium tracking-wide text-zinc-400 md:flex">
            {LINKS.map((l) => (
              <Link key={l.href} href={l.href} className="transition-colors hover:text-white">
                {l.label}
              </Link>
            ))}
            <Link href="/book/demo" className="transition-colors hover:text-white">
              Demo
            </Link>
          </nav>

          <div className="flex items-center gap-2">
            <Link
              href="/login"
              className="hidden rounded-full border border-transparent px-5 py-2 text-[14px] font-medium text-white transition-colors hover:bg-white/10 sm:block"
            >
              Sign in
            </Link>

            {/* The one action worth a permanent slot on a phone. Everything
                else moves into the sheet rather than being hidden outright,
                which is what `hidden md:flex` used to do to the whole nav. */}
            <Link
              href="/login"
              className="flex min-h-11 items-center rounded-full border border-white/20 bg-white/5 px-4 text-[14px] font-medium text-white shadow-sm transition-all hover:bg-white hover:text-black active:scale-[0.98] sm:px-5"
            >
              Get started
            </Link>

            <button
              ref={toggleRef}
              type="button"
              onClick={() => setOpen((v) => !v)}
              aria-expanded={open}
              aria-controls="mobile-nav"
              aria-label={open ? 'Close menu' : 'Open menu'}
              className="-mr-1 flex h-11 w-11 items-center justify-center rounded-full text-white transition-colors hover:bg-white/10 active:bg-white/20 md:hidden"
            >
              {open ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>

        {/* The sheet. Rendered always so it can transition, and made inert when
            closed so its links stay out of the tab order and off a screen
            reader. */}
        <div
          id="mobile-nav"
          ref={panelRef}
          inert={!open}
          className={`mx-auto mt-2 w-full max-w-5xl origin-top overflow-hidden rounded-3xl border border-white/10 bg-black/80 shadow-[0_20px_60px_rgba(0,0,0,0.6)] backdrop-blur-2xl transition-all duration-300 md:hidden ${
            open
              ? 'pointer-events-auto translate-y-0 scale-100 opacity-100'
              : 'pointer-events-none -translate-y-2 scale-[0.98] opacity-0'
          }`}
        >
          <nav className="flex flex-col p-2">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={close}
                className="rounded-2xl px-4 py-3.5 text-[15px] font-medium text-zinc-300 transition-colors hover:bg-white/10 hover:text-white active:bg-white/15"
              >
                {l.label}
              </Link>
            ))}
          </nav>

          {/* The two things a first-time visitor actually wants, as buttons
              rather than another line of text: see it work, or start. */}
          <div className="flex flex-col gap-2 border-t border-white/10 p-3">
            <Link
              href="/book/demo"
              onClick={close}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full border border-white/20 px-5 text-[15px] font-semibold text-white transition-colors hover:bg-white/10 active:bg-white/15"
            >
              <PlayCircle size={18} />
              See a live edition
            </Link>
            <Link
              href="/login"
              onClick={close}
              className="flex min-h-12 items-center justify-center gap-2 rounded-full bg-white px-5 text-[15px] font-semibold text-black transition-transform active:scale-[0.98]"
            >
              Get started free
              <ArrowRight size={18} />
            </Link>
            <Link
              href="/login"
              onClick={close}
              className="flex min-h-12 items-center justify-center rounded-full px-5 text-[14px] font-medium text-zinc-400 transition-colors hover:text-white"
            >
              Already have an account? Sign in
            </Link>
          </div>
        </div>
      </div>
    </header>
  )
}
