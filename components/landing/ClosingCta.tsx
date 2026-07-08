import Link from 'next/link'
import Reveal from './Reveal'

export function ClosingCta() {
  return (
    <section className="px-5 py-28">
      <div className="mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-[var(--qlico-ink)] px-8 py-20 text-center text-white">
        <Reveal>
          <h2 className="font-display mx-auto max-w-2xl text-4xl font-semibold leading-[1.08] tracking-[-0.02em] sm:text-5xl">
            Your next publication deserves more.
          </h2>
          <p className="mx-auto mt-5 max-w-lg text-lg text-white/60">
            Build it once. Ship it on the web, embedded, and installed as an app.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-4 sm:flex-row">
            <Link href="/login" className="w-full rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-[var(--qlico-ink)] transition hover:bg-white/90 sm:w-auto">
              Start for free
            </Link>
            <Link href="/book/demo" className="text-[15px] font-medium text-white/80 transition hover:text-white">
              Explore the demo →
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
