import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'

interface Props {
  hasBook: boolean
  hasHotspot: boolean
  hasPublished: boolean
  firstBookId?: string
}

/**
 * First-run checklist: import → enrich → publish. Renders until all three
 * steps are done, then disappears for good. Activation (redeemed → first
 * publish) is the metric AppSumo buyers are graded on — this walks them there.
 */
export function OnboardingChecklist({ hasBook, hasHotspot, hasPublished, firstBookId }: Props) {
  const steps = [
    {
      done: hasBook,
      title: 'Create your first edition',
      desc: 'Import a PDF or start from a blank page.',
      href: '/create',
      cta: 'Create',
    },
    {
      done: hasHotspot,
      title: 'Add a hotspot',
      desc: 'Drop a tappable pin on any page — info, link, or checkout.',
      href: firstBookId ? `/editor/${firstBookId}` : '/create',
      cta: 'Open editor',
    },
    {
      done: hasPublished,
      title: 'Publish it',
      desc: 'Get a hosted link you can share and embed anywhere.',
      href: firstBookId ? `/editor/${firstBookId}` : '/create',
      cta: 'Publish',
    },
  ]

  if (steps.every((s) => s.done)) return null
  const doneCount = steps.filter((s) => s.done).length

  return (
    <section className="mb-8 rounded-[2.25rem] border border-[var(--qlico-border)] bg-[#ffffff]/76 p-6 shadow-sm backdrop-blur sm:p-8">
      <div className="mb-5 flex items-center justify-between">
        <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">Get set up</h2>
        <span className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--qlico-muted)]">
          {doneCount} of {steps.length}
        </span>
      </div>
      <ol className="grid gap-3 sm:grid-cols-3">
        {steps.map((step, i) => (
          <li key={step.title}>
            <Link
              href={step.href}
              aria-disabled={step.done}
              className={`group flex h-full flex-col rounded-2xl border p-5 transition ${
                step.done
                  ? 'pointer-events-none border-[var(--qlico-border)] bg-[var(--qlico-subtle)] opacity-70'
                  : 'border-[var(--qlico-border)] bg-white hover:-translate-y-0.5 hover:shadow-[var(--qlico-shadow)]'
              }`}
            >
              <span
                className={`mb-3 grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                  step.done
                    ? 'bg-[var(--accent)] text-white'
                    : 'border border-[var(--qlico-border)] text-[var(--qlico-muted)]'
                }`}
              >
                {step.done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <h3 className={`text-[15px] font-semibold ${step.done ? 'line-through' : ''}`}>{step.title}</h3>
              <p className="mt-1 text-[13px] leading-5 text-[var(--qlico-muted)]">{step.desc}</p>
              {!step.done && (
                <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--accent)] transition group-hover:gap-2">
                  {step.cta} <ArrowRight size={13} />
                </span>
              )}
            </Link>
          </li>
        ))}
      </ol>
    </section>
  )
}
