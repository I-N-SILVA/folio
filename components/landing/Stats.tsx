import Reveal from './Reveal'
import { NumberTicker } from './NumberTicker'

const STATS = [
  { value: 10, suffix: '×', label: 'More engaging than a static PDF' },
  { value: 3, suffix: ' min', label: 'From PDF to published edition' },
  { value: 100, suffix: '%', label: 'Your data, your infrastructure' },
]

export function Stats() {
  return (
    <section className="px-5 py-24">
      <div className="mx-auto grid max-w-4xl gap-10 text-center sm:grid-cols-3">
        {STATS.map((s) => (
          <Reveal key={s.label}>
            <div className="font-display text-6xl font-semibold tracking-[-0.03em] text-[var(--qlico-ink)]">
              <NumberTicker value={s.value} suffix={s.suffix} />
            </div>
            <p className="mx-auto mt-3 max-w-[12rem] text-[15px] leading-6 text-[var(--qlico-muted)]">{s.label}</p>
          </Reveal>
        ))}
      </div>
    </section>
  )
}
