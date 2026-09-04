import Link from 'next/link'
import type { Metadata } from 'next'
import { ArrowRight, BookOpen } from 'lucide-react'
import { TEMPLATES } from '@/data/templates'

/**
 * Six finished editions, readable by anyone, with no account.
 *
 * They already existed — `data/templates.ts` holds six complete publications
 * with real typography, hotspots and product grids — and were reachable from
 * exactly one door of one modal, invisible on the landing page and impossible
 * to link to. "Unmatched elegance" is a claim; a twelve-page lookbook a stranger
 * can flip through is proof, and it costs a route.
 *
 * Nothing here touches the database. `generateBook` returns a whole Book, so a
 * gallery edition is rendered straight from the template with no seeding, no
 * owner and no rows to keep in sync.
 */

export const metadata: Metadata = {
  title: 'Gallery — real QLICO editions you can read',
  description:
    'Six finished editions — a lookbook, an architecture monograph, a tasting menu, an annual report, a portfolio and a whitepaper. Open any of them, then start your own from it.',
}

export default function GalleryPage() {
  const categories = Array.from(new Set(TEMPLATES.map((t) => t.category)))

  return (
    <main className="qlico-grain min-h-screen bg-[var(--background)] px-5 py-10 text-[var(--qlico-ink)] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <header className="mb-10 flex flex-wrap items-center justify-between gap-4">
          <Link href="/" className="flex items-center gap-2 text-sm font-semibold text-[var(--qlico-muted)] transition-colors hover:text-[var(--qlico-ink)]">
            <BookOpen size={16} />
            QLICO
          </Link>
          <Link
            href="/dashboard?new=1"
            className="rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
          >
            Make your own
          </Link>
        </header>

        <section className="mb-12 max-w-3xl">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--qlico-muted)]">
            {TEMPLATES.length} editions · {categories.length} kinds of publication
          </p>
          <h1 className="font-display text-5xl font-semibold leading-none tracking-[-0.05em] sm:text-6xl">
            Read one before you make one.
          </h1>
          <p className="mt-5 text-base leading-7 text-[var(--qlico-muted)]">
            These are real editions, not screenshots. Open any of them and flip through — no
            account, nothing to sign up for. When one is close to what you need, start from it and
            replace the words.
          </p>
        </section>

        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {TEMPLATES.map((tmpl) => (
            <article
              key={tmpl.id}
              className="group flex flex-col overflow-hidden rounded-[1.75rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/70 shadow-sm transition-shadow hover:shadow-[var(--qlico-shadow)]"
            >
              {/* A cover drawn from the template's own palette, so each card
                  looks like the edition behind it rather than like the others. */}
              <Link
                href={`/gallery/${tmpl.id}`}
                aria-label={`Read ${tmpl.title}`}
                className="relative flex aspect-[4/3] flex-col justify-between overflow-hidden p-5"
                style={{ backgroundColor: tmpl.previewMockup.bgHex, color: tmpl.previewMockup.textHex }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.14em]"
                    style={{
                      backgroundColor: `${tmpl.previewMockup.accentHex}22`,
                      color: tmpl.previewMockup.accentHex,
                      border: `1px solid ${tmpl.previewMockup.accentHex}44`,
                    }}
                  >
                    {tmpl.previewMockup.tag}
                  </span>
                  <span className="text-[10px] font-medium opacity-60 tabular-nums">
                    {tmpl.pagesCount} pages
                  </span>
                </div>

                <div>
                  <h2 className="font-display text-2xl font-semibold leading-none tracking-[-0.03em]">
                    {tmpl.previewMockup.headline}
                  </h2>
                  <p className="mt-1.5 text-[11px] leading-4 opacity-75">
                    {tmpl.previewMockup.subheadline}
                  </p>
                </div>

                <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/25 to-transparent" />
              </Link>

              <div className="flex flex-1 flex-col gap-3 p-5">
                <div>
                  <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--qlico-muted)]">
                    {tmpl.category}
                  </p>
                  <h3 className="mt-1 font-display text-lg font-semibold leading-tight tracking-[-0.02em]">
                    {tmpl.title}
                  </h3>
                </div>
                <p className="text-[13px] leading-5 text-[var(--qlico-muted)]">{tmpl.subtitle}</p>

                <ul className="flex flex-wrap gap-1.5">
                  {tmpl.badges.map((badge) => (
                    <li
                      key={badge}
                      className="rounded-full border border-[var(--qlico-border)] px-2 py-0.5 text-[10px] font-semibold text-[var(--qlico-muted)]"
                    >
                      {badge}
                    </li>
                  ))}
                </ul>

                <div className="mt-auto flex items-center gap-2 pt-2">
                  <Link
                    href={`/gallery/${tmpl.id}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full border border-[var(--qlico-border)] px-4 py-2 text-xs font-semibold transition-colors hover:bg-[var(--tint-weak)]"
                  >
                    Read it
                  </Link>
                  <Link
                    href={`/dashboard?new=1&template=${tmpl.id}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-2 text-xs font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
                  >
                    Start from this
                    <ArrowRight size={13} />
                  </Link>
                </div>
              </div>
            </article>
          ))}
        </div>
      </div>
    </main>
  )
}
