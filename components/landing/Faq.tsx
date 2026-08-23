'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Plus } from 'lucide-react'
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
    <div className="border-b border-white/10 group">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full items-center justify-between gap-4 py-8 text-left outline-none transition-all duration-300"
      >
        <span className="font-display text-2xl font-medium tracking-tight text-white transition-colors group-hover:text-zinc-300">{q}</span>
        <motion.div
          animate={{ rotate: open ? 45 : 0 }}
          transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 20 }}
          className="shrink-0 flex items-center justify-center h-10 w-10 rounded-full border border-white/10 bg-white/5 text-zinc-400 group-hover:bg-white/10 group-hover:text-white transition-colors"
        >
          <Plus size={20} strokeWidth={1.5} />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {open && (
          <motion.div 
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.4, type: "spring", stiffness: 200, damping: 25 }}
            className="overflow-hidden"
          >
            <p className="pb-8 pt-2 text-lg font-normal leading-relaxed text-zinc-400 max-w-3xl pr-12">{a}</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

export function Faq() {
  return (
    <section id="faq" className="bg-[#050505] px-5 py-24 sm:py-32">
      <div className="mx-auto max-w-4xl">
        <Reveal className="mb-20">
          <h2 className="font-display text-4xl font-medium tracking-tight sm:text-5xl lg:text-6xl text-white">
            Questions.
          </h2>
          <p className="mt-4 text-xl text-zinc-400">
            Everything you need to know about the platform.
          </p>
        </Reveal>
        
        <div className="border-t border-white/10">
          {FAQS.map((item) => (
            <FaqItem key={item.q} q={item.q} a={item.a} />
          ))}
        </div>
      </div>
    </section>
  )
}
