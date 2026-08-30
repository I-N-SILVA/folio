import Link from 'next/link'
import { Check, ArrowRight } from 'lucide-react'

interface Props {
  hasBook: boolean
  hasPublished: boolean
  /** Whether anyone has actually opened a published edition. */
  hasReader: boolean
  firstBookId?: string
  firstBookSlug?: string
}

/**
 * First-run checklist, ending at the activation event rather than at a feature.
 *
 * It used to read create → add a hotspot → publish. The middle step was the
 * product's agenda, not the author's: nobody signs up to place a pin, and the
 * step linked to an editor where the hotspot tool was an unlabelled toggle. It
 * also stopped one step short of the point — an edition nobody has opened
 * produces no analytics, no leads and no reason to come back, so "published" is
 * not the finish line. "Someone read it" is.
 */
export function OnboardingChecklist({
  hasBook,
  hasPublished,
  hasReader,
  firstBookId,
  firstBookSlug,
}: Props) {
  const steps = [
    {
      done: hasBook,
      title: 'Create your first edition',
      desc: 'Drop in a PDF, or start from a blank page.',
      href: '/dashboard?new=1',
      cta: 'Create',
    },
    {
      done: hasPublished,
      title: 'Publish it',
      desc: 'Turns it into a link anyone can open — no account, no app.',
      href: firstBookId ? `/editor/${firstBookId}` : '/dashboard?new=1',
      cta: 'Open the editor',
    },
    {
      done: hasReader,
      title: 'Send the link to one person',
      desc: 'The moment someone opens it, Insights starts filling in.',
      href: hasPublished && firstBookSlug ? `/analytics/${firstBookSlug}` : '/insights',
      cta: 'Get the link',
    },
  ]

  if (steps.every((s) => s.done)) return null
  const doneCount = steps.filter((s) => s.done).length

  return (
    <section className="mb-8 rounded-[2.25rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/76 p-6 shadow-sm backdrop-blur sm:p-8">
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
                  : 'border-[var(--qlico-border)] bg-[var(--qlico-paper)] hover:-translate-y-0.5 hover:shadow-[var(--qlico-shadow)]'
              }`}
            >
              <span
                className={`mb-3 grid h-7 w-7 place-items-center rounded-full text-xs font-bold ${
                  step.done
                    ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
                    : 'border border-[var(--qlico-border)] text-[var(--qlico-muted)]'
                }`}
              >
                {step.done ? <Check size={14} strokeWidth={3} /> : i + 1}
              </span>
              <h3 className={`text-[15px] font-semibold ${step.done ? 'line-through' : ''}`}>
                {step.title}
              </h3>
              <p className="mt-1 text-[13px] leading-5 text-[var(--qlico-muted)]">{step.desc}</p>
              {!step.done && (
                <span className="mt-3 inline-flex items-center gap-1 text-[13px] font-semibold text-[var(--accent-fg)] transition group-hover:gap-2">
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
