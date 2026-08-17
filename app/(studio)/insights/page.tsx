import Link from 'next/link'
import { redirect } from 'next/navigation'
import { ArrowRight, BookOpen, Mail, Users } from 'lucide-react'
import { createServerSupabase } from '@/lib/supabase-server'
import { getEditionEngagement } from '@/lib/insights'
import { StudioNav } from '@/components/studio/StudioNav'
import { NumberTicker } from '@/components/landing/NumberTicker'
import Reveal from '@/components/landing/Reveal'

export const dynamic = 'force-dynamic'

/**
 * One screen for "is anything I published being read?".
 *
 * Per-edition analytics already existed and was genuinely good, but it was
 * reachable only from an unlabelled icon on a book card and only one edition at
 * a time — so the numbers that change while the author is away, which are the
 * only reason to come back tomorrow, were the hardest thing in the product to
 * find.
 */
export default async function InsightsPage() {
  const supabase = await createServerSupabase()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login?next=%2Finsights')

  const { data } = await supabase
    .from('books')
    .select('id, title, slug, settings, updated_at')
    .eq('owner_id', user.id)
    .order('updated_at', { ascending: false })

  const books = data ?? []
  const published = books.filter((b) => b.settings?.published)
  const engagement = await getEditionEngagement(
    user.id,
    published.map((b) => b.id),
    user.email
  )

  const ranked = [...published].sort(
    (a, b) =>
      (engagement.byBook.get(b.id)?.readers ?? 0) - (engagement.byBook.get(a.id)?.readers ?? 0)
  )

  return (
    <main className="qlico-grain min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--qlico-ink)] sm:px-8">
      <div className="mx-auto max-w-5xl">
        <StudioNav current="insights" />

        <section className="mb-8">
          <h1 className="font-display text-4xl font-semibold tracking-[-0.04em] sm:text-5xl">
            Who&apos;s reading
          </h1>
          <p className="mt-3 text-sm leading-6 text-[var(--qlico-muted)]">
            Every published edition, over the last {engagement.windowDays} days.
          </p>

          <div className="mt-6 grid gap-4 sm:grid-cols-3">
            <SummaryCard icon={<Users size={16} />} label="Readers">
              <NumberTicker value={engagement.totalReaders} />
            </SummaryCard>
            <SummaryCard icon={<Mail size={16} />} label="Emails captured">
              <NumberTicker value={engagement.totalLeads} />
            </SummaryCard>
            <SummaryCard icon={<BookOpen size={16} />} label="Live editions">
              <NumberTicker value={published.length} />
            </SummaryCard>
          </div>
        </section>

        {published.length === 0 ? (
          <section className="rounded-[2rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/78 px-6 py-16 text-center">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.03em]">
              Nothing is published yet.
            </h2>
            <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--qlico-muted)]">
              {books.length > 0
                ? 'You have editions in draft. Publish one and its readers will show up here.'
                : 'Import a PDF, publish it, and send the link to one person. This page fills in from there.'}
            </p>
            <Link
              href="/dashboard"
              className="mt-6 inline-block rounded-full bg-[var(--accent)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--accent-hover)]"
            >
              {books.length > 0 ? 'Go to your editions' : 'Create your first edition'}
            </Link>
          </section>
        ) : (
          <section className="overflow-hidden rounded-[2rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/78">
            <div className="overflow-x-auto">
              <table className="w-full min-w-[36rem] text-sm">
                <caption className="sr-only">
                  Published editions ranked by number of readers
                </caption>
                <thead>
                  <tr className="border-b border-[var(--qlico-border)] text-left text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qlico-muted)]">
                    <th scope="col" className="px-6 py-4">Edition</th>
                    <th scope="col" className="px-4 py-4 text-right">Readers</th>
                    <th scope="col" className="px-4 py-4 text-right">Finished</th>
                    <th scope="col" className="px-4 py-4 text-right">Emails</th>
                    <th scope="col" className="px-6 py-4 text-right">
                      <span className="sr-only">Open</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {ranked.map((book) => {
                    const stats = engagement.byBook.get(book.id)
                    return (
                      <tr
                        key={book.id}
                        className="border-b border-[var(--qlico-hairline)] last:border-0 hover:bg-[var(--tint-weak)]"
                      >
                        <th scope="row" className="px-6 py-4 text-left font-semibold">
                          {book.title}
                          <span className="mt-0.5 block text-xs font-normal text-[var(--qlico-muted)]">
                            /book/{book.slug}
                          </span>
                        </th>
                        <td className="px-4 py-4 text-right tabular-nums">{stats?.readers ?? 0}</td>
                        <td className="px-4 py-4 text-right tabular-nums text-[var(--qlico-muted)]">
                          {stats?.readers ? `${stats.completionRate}%` : '—'}
                        </td>
                        <td className="px-4 py-4 text-right tabular-nums">{stats?.leads ?? 0}</td>
                        <td className="px-6 py-4 text-right">
                          <Link
                            href={`/analytics/${book.slug}`}
                            className="inline-flex items-center gap-1 text-sm font-semibold text-[var(--accent-fg)] hover:underline"
                          >
                            Details
                            <ArrowRight size={13} />
                          </Link>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {published.length > 0 && engagement.totalReaders === 0 && (
          <p className="mt-6 text-center text-sm leading-6 text-[var(--qlico-muted)]">
            No reads yet. An edition needs one person to open it before any of this moves —{' '}
            <Link href="/dashboard" className="font-semibold text-[var(--accent-fg)] hover:underline">
              copy a link and send it
            </Link>
            .
          </p>
        )}
      </div>
    </main>
  )
}

function SummaryCard({
  icon,
  label,
  children,
}: {
  icon: React.ReactNode
  label: string
  children: React.ReactNode
}) {
  return (
    <Reveal>
      <div className="rounded-3xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/60 p-5">
        <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.16em] text-[var(--qlico-muted)]">
          <span className="text-[var(--accent-fg)]">{icon}</span>
          {label}
        </p>
        <p className="font-display mt-2 text-4xl font-semibold tracking-[-0.05em] tabular-nums">
          {children}
        </p>
      </div>
    </Reveal>
  )
}
