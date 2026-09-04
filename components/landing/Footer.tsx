import Link from 'next/link'
import { Mark } from './Mark'

export function Footer() {
  return (
    <footer className="border-t border-white/10 px-5 py-16 bg-[#050505] text-white">
      <div className="mx-auto max-w-7xl">
        <div className="flex flex-col gap-12 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex items-center text-white">
              <Mark className="h-8 w-auto" />
            </div>
            <p className="mt-6 max-w-xs text-[15px] font-normal leading-relaxed text-zinc-400">
              Interactive publishing — with craft, context, and control.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-x-16 gap-y-4 text-[14px] font-medium tracking-wide sm:grid-cols-3">
            <Link href="#features" className="text-zinc-500 transition-colors hover:text-white">Features</Link>
            <Link href="#pricing" className="text-zinc-500 transition-colors hover:text-white">Pricing</Link>
            <Link href="/book/demo" className="text-zinc-500 transition-colors hover:text-white">Demo</Link>
            <Link href="/gallery" className="text-zinc-500 transition-colors hover:text-white">Gallery</Link>
            <Link href="/help" className="text-zinc-500 transition-colors hover:text-white">Help</Link>
            <Link href="/press" className="text-zinc-500 transition-colors hover:text-white">Press</Link>
            <Link href="/privacy" className="text-zinc-500 transition-colors hover:text-white">Privacy</Link>
            <Link href="/terms" className="text-zinc-500 transition-colors hover:text-white">Terms</Link>
          </div>
        </div>
        <div className="mt-16 flex flex-col sm:flex-row sm:items-center justify-between border-t border-white/5 pt-8 text-[13px] font-medium text-zinc-600">
          <span>© {new Date().getFullYear()} QLICO. All rights reserved.</span>
          <span className="mt-4 sm:mt-0 text-zinc-500">Designed with precision.</span>
        </div>
      </div>
      
      {/* Soft elegant typographic footer */}
      <div className="w-full flex justify-center overflow-hidden pointer-events-none select-none mt-16 border-t border-white/5 pt-12">
        <h2 className="font-display text-[20vw] leading-[0.75] font-medium tracking-tighter text-zinc-800 whitespace-nowrap">
          QLICO
        </h2>
      </div>
    </footer>
  )
}
