import Reveal from './Reveal'

const STEPS = [
  ['01', 'Compose', 'Start from a PDF or build page-by-page with modular blocks.'],
  ['02', 'Enrich', 'Add hotspots, lead gates, themes, and metadata.'],
  ['03', 'Publish', 'Share a hosted reader, embed it anywhere, measure everything.'],
]

export function HowItWorks() {
  return (
    <section id="how" className="bg-[var(--background-alt)] px-5 py-28">
      <div className="mx-auto max-w-5xl">
        <Reveal className="mb-14 max-w-2xl">
          <span className="mb-5 block h-9 w-[3px] rounded-full bg-[var(--accent)]" />
          <h2 className="font-display text-4xl font-semibold tracking-[-0.02em] sm:text-5xl">From flat file to living edition.</h2>
        </Reveal>

        {/* Animated flow conduit */}
        <div className="relative mb-6 hidden h-[3px] overflow-hidden rounded-full bg-[var(--qlico-border)] lg:block">
          <div className="qlico-flow-line absolute inset-0" />
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          {STEPS.map(([num, title, desc], i) => (
            <Reveal key={num} delay={i * 90}>
              <div className="h-full rounded-2xl border border-[var(--qlico-border)] bg-white p-8">
                <span className="font-display text-sm font-semibold text-[var(--accent)]">{num}</span>
                <h3 className="mt-4 text-xl font-semibold tracking-[-0.01em]">{title}</h3>
                <p className="mt-2 text-[15px] leading-7 text-[var(--qlico-muted)]">{desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </div>
    </section>
  )
}
