import Link from 'next/link'
import Reveal from './Reveal'

export function Statement() {
  return (
    <section className="bg-[var(--qlico-ink)] px-5 py-28 text-white">
      <div className="mx-auto max-w-4xl text-center">
        <Reveal>
          <h2 className="font-display text-4xl font-semibold leading-[1.08] tracking-[-0.02em] sm:text-6xl">
            A download link is where good work goes to be forgotten.
          </h2>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-8 text-white/60">
            QLICO gives your publication a reason to be opened, explored, and finished — and
            shows you exactly what held attention.
          </p>
          <Link href="/login" className="mt-9 inline-block rounded-full bg-white px-7 py-3.5 text-[15px] font-semibold text-[var(--qlico-ink)] transition hover:bg-white/90">
            Create your first edition
          </Link>
        </Reveal>
      </div>
    </section>
  )
}
