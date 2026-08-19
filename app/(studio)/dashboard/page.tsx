import { Suspense } from 'react'
import { redirect } from 'next/navigation'
import { Sparkles, BookOpen } from 'lucide-react'
import { SignInTracker } from '@/components/studio/SignInTracker'
import { createServerSupabase } from '@/lib/supabase-server'
import { DashboardActions } from '@/components/studio/DashboardActions'
import { CreateBookLauncher } from '@/components/studio/CreateBookLauncher'
import { StudioNav } from '@/components/studio/StudioNav'
import { OnboardingChecklist } from '@/components/studio/OnboardingChecklist'
import { LibraryBrowser } from '@/components/studio/LibraryBrowser'
import Reveal from '@/components/landing/Reveal'
import { NumberTicker } from '@/components/landing/NumberTicker'
import { getEditionEngagement, type EditionEngagement } from '@/lib/insights'
import type { Book, Page } from '@/lib/book-schema'

type DashboardBook = Omit<Book, 'pages'> & {
  pages?: { id: string; hotspots?: unknown[] }[]
  /** First page, fetched separately so cards can show a real preview. */
  cover?: Page | null
  /** Reader numbers, so a card says how the edition is doing, not just that it exists. */
  engagement?: EditionEngagement | null
}

async function getBooks(): Promise<DashboardBook[]> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  // Returning [] rendered a convincing but empty dashboard to a signed-out
  // visitor. That only ever showed up if the middleware didn't run — which it
  // skips whenever the Supabase env vars are missing, exactly the misconfigured
  // deploy where you'd least want the studio to look reachable.
  if (!user) redirect('/login?next=%2Fdashboard')

  const { data } = await supabase
    .from('books')
    .select('*, pages(id, hotspots)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  const books = (data ?? []) as DashboardBook[]
  if (books.length === 0) return books

  // One extra bounded query rather than pulling every page's blocks into the
  // list query — this is one row per book regardless of how long a book is.
  const { data: covers } = await supabase
    .from('pages')
    .select('*')
    .eq('page_number', 1)
    .in('book_id', books.map((b) => b.id))

  const coverByBook = new Map((covers ?? []).map((p: Page) => [p.book_id, p]))

  // Reader numbers for the published ones, so a card can say "18 reads" rather
  // than only "Published".
  const engagement = await getEditionEngagement(
    user.id,
    books.filter((b) => b.settings?.published).map((b) => b.id),
    user.email
  )

  return books.map((book) => ({
    ...book,
    cover: coverByBook.get(book.id) ?? null,
    engagement: engagement.byBook.get(book.id) ?? null,
  }))
}

export default async function DashboardPage(props: { searchParams: Promise<{ [key: string]: string | string[] | undefined }> }) {
  const searchParams = await props.searchParams
  const isResuming = searchParams?.resume === '1'
  
  const books = await getBooks()
  const publishedCount = books.filter((book) => book.settings?.published).length
  const readers = books.reduce((total, book) => total + (book.engagement?.readers ?? 0), 0)
  const leads = books.reduce((total, book) => total + (book.engagement?.leads ?? 0), 0)
  const firstBook = books[books.length - 1]

  return (
    <main className="qlico-grain min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--qlico-ink)] sm:px-8">
      <CreateBookLauncher />
      {/* useSearchParams needs a boundary, or the whole route opts into CSR. */}
      <Suspense fallback={null}>
        <SignInTracker />
      </Suspense>
      <div className="mx-auto max-w-6xl">
        <StudioNav current="library" />
        <section className="mb-8 overflow-hidden rounded-[2.25rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/76 p-6 shadow-[var(--qlico-shadow)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--qlico-teal)]">
                <Sparkles size={13} />
                Creator Studio
              </div>
              <h1 className="font-display text-5xl font-semibold leading-none tracking-[-0.06em] sm:text-6xl">
                Your editions
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--qlico-muted)] sm:text-base">
                {publishedCount === 0
                  ? 'Publish one and send the link — everything else follows from a reader opening it.'
                  : `${publishedCount} live · ${readers} ${readers === 1 ? 'reader' : 'readers'} recently.`}
              </p>
            </div>
            <DashboardActions />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Reveal delay={0}><StatCard label="Readers" value={readers} /></Reveal>
            <Reveal delay={70}><StatCard label="Emails captured" value={leads} /></Reveal>
            <Reveal delay={140}><StatCard label="Live editions" value={publishedCount} /></Reveal>
          </div>
        </section>

        <OnboardingChecklist
          hasBook={books.length > 0}
          hasPublished={publishedCount > 0}
          hasReader={readers > 0}
          firstBookId={firstBook?.id}
          firstBookSlug={firstBook?.slug}
        />

        {books.length === 0 ? (
          isResuming ? (
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              <div className="flex aspect-[10/14] flex-col justify-end overflow-hidden rounded-2xl border border-[var(--qlico-border)] bg-[var(--qlico-subtle)] p-5">
                <div className="flex animate-pulse flex-col gap-3">
                  <div className="h-4 w-3/4 rounded-full bg-[var(--qlico-border)]"></div>
                  <div className="h-4 w-1/2 rounded-full bg-[var(--qlico-border)]"></div>
                  <p className="mt-2 text-xs font-semibold text-[var(--accent-fg)]">Importing your edition...</p>
                </div>
              </div>
            </div>
          ) : (
            <section className="relative overflow-hidden rounded-[2.25rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/78 px-6 py-20 text-center shadow-sm">
              <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(60,35,132,0.16)] blur-3xl" />
              <div className="relative mx-auto mb-6 grid h-32 w-32 place-items-center rounded-[2.5rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)] shadow-sm">
                <BookOpen size={48} className="text-[var(--qlico-muted)] opacity-60" strokeWidth={1.5} />
              </div>
              <h2 className="font-display text-4xl font-semibold tracking-[-0.04em]">Create your first edition.</h2>
              <p className="mx-auto mb-8 mt-3 max-w-md text-sm leading-6 text-[var(--qlico-muted)]">
                Drop in a PDF and it becomes something people can read, click through, and finish —
                on any device, from one link.
              </p>
              <DashboardActions />
            </section>
          )
        ) : (
          <LibraryBrowser books={books} />
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/55 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--qlico-muted)]">{label}</p>
      <p className="mt-2 font-display text-4xl font-semibold tracking-[-0.06em]">
        <NumberTicker value={value} />
      </p>
    </div>
  )
}
