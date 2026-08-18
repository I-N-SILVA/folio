'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import Reveal from './Reveal'

const FAQS = [
  { q: 'How is this different from a flipbook tool?', a: 'QLICO makes editions, not exports. Pages can be shoppable (checkout in place), bound to live data (prices, stock, dates that update after publish), and read with a tactile fore-edge you browse to navigate. A PDF can’t do any of that.' },
  { q: 'Do readers need an account or app?', a: 'No. Every edition is a hosted link that opens instantly in any browser, and embeds anywhere with one line of code.' },
  { q: 'Can I import an existing PDF?', a: 'Yes. Drop in a PDF and QLICO turns each page into an interactive spread you can enrich with hotspots, links, and media.' },
  { q: 'Who owns the reader data?', a: 'You do. Opens, dwell time, completion and hotspot clicks are recorded against your edition, and you can export every event and every captured email as CSV at any time. We never sell it or use it to market to your readers.' },
  { q: 'Is QLICO installable as an app?', a: 'Yes. QLICO is a progressive web app you can install on iOS and Android, and it works offline.' },
  { q: 'Can I use my own branding?', a: 'Paid plans remove the QLICO badge from the reader and let you set your own theme, fonts and cover. Custom domains are on the roadmap, not shipped — we only list what works today.' },
]

function FaqItem({ q, a }: { q: string; a: string }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="border-b border-[var(--qlico-border)]">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-6 text-left"
      >
        <span className="text-lg font-medium tracking-[-0.01em]">{q}</span>
        <ChevronDown size={20} className={`shrink-0 text-[var(--qlico-muted)] transition-transform duration-300 ${open ? 'rotate-180' : ''}`} />
      </button>
      <div className={`grid transition-all duration-300 ease-out ${open ? 'grid-rows-[1fr] pb-6 opacity-100' : 'grid-rows-[0fr] opacity-0'}`}>
        <p className="overflow-hidden text-[15px] leading-7 text-[var(--qlico-muted)]">{a}</p>
      </div>
    </div>
  )
}

export function Faq() {
  return (
    <section id="faq" className="bg-[var(--background-alt)] px-5 py-28">
      <div className="mx-auto max-w-3xl">
        <Reveal className="mb-12 text-center">
          <h2 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">Questions, answered.</h2>
        </Reveal>
        <div>
          {FAQS.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>
    </section>
  )
}
