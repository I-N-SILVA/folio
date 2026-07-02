import { LibraryBig, Plus, Sparkles, BookOpen } from 'lucide-react'
import { createServerSupabase } from '@/lib/supabase-server'
import { DashboardActions } from '@/components/studio/DashboardActions'
import { BookCard } from '@/components/studio/BookCard'
import Reveal from '@/components/landing/Reveal'
import { NumberTicker } from '@/components/landing/NumberTicker'
import type { Book } from '@/lib/book-schema'

type DashboardBook = Omit<Book, 'pages'> & { pages?: { id: string }[] }

async function getBooks(): Promise<DashboardBook[]> {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('books')
    .select('*, pages(id)')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return (data ?? []) as DashboardBook[]
}

export default async function DashboardPage() {
  const books = await getBooks()
  const publishedCount = books.filter((book) => book.settings?.published).length
  const pageCount = books.reduce((total, book) => total + (book.pages?.length ?? 0), 0)

  return (
    <main className="folio-grain min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--folio-ink)] sm:px-8">
      <div className="mx-auto max-w-6xl">
        <section className="mb-8 overflow-hidden rounded-[2.25rem] border border-[var(--folio-border)] bg-[#ffffff]/76 p-6 shadow-[var(--folio-shadow)] backdrop-blur sm:p-8">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[var(--folio-border)] bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--folio-teal)]">
                <Sparkles size={13} />
                Creator Studio
              </div>
              <h1 className="font-display text-5xl font-semibold leading-none tracking-[-0.06em] sm:text-6xl">
                Your digital shelf
              </h1>
              <p className="mt-4 max-w-2xl text-sm leading-6 text-[var(--folio-muted)] sm:text-base">
                Compose, publish, and measure interactive publications from one calm workspace.
              </p>
            </div>
            <DashboardActions />
          </div>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            <Reveal delay={0}><StatCard label="Books" value={books.length} /></Reveal>
            <Reveal delay={70}><StatCard label="Published" value={publishedCount} /></Reveal>
            <Reveal delay={140}><StatCard label="Pages" value={pageCount} /></Reveal>
          </div>
        </section>

        {books.length === 0 ? (
          <section className="relative overflow-hidden rounded-[2.25rem] border border-[var(--folio-border)] bg-[#ffffff]/78 px-6 py-20 text-center shadow-sm">
            <div className="absolute left-1/2 top-0 h-56 w-56 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[rgba(60,35,132,0.16)] blur-3xl" />
            <div className="relative mx-auto mb-6 grid h-32 w-32 place-items-center rounded-[2.5rem] border border-[var(--folio-border)] bg-white shadow-sm">
              <BookOpen size={48} className="text-[var(--folio-muted)] opacity-60" strokeWidth={1.5} />
            </div>
            <h2 className="font-display text-4xl font-semibold tracking-[-0.04em]">Create your first edition.</h2>
            <p className="mx-auto mb-8 mt-3 max-w-md text-sm leading-6 text-[var(--folio-muted)]">
              Create interactive portfolios, catalogs, magazines, and reports that feel crafted on every device.
            </p>
            <DashboardActions />
          </section>
        ) : (
          <section>
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--folio-muted)]">
              <LibraryBig size={16} />
              Library
            </div>
            <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {books.map((book, i) => (
                <Reveal key={book.id} delay={(i % 3) * 70}>
                  <BookCard book={book} />
                </Reveal>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-3xl border border-[var(--folio-border)] bg-white/55 p-5 shadow-sm">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--folio-muted)]">{label}</p>
      <p className="mt-2 font-display text-4xl font-semibold tracking-[-0.06em]">
        <NumberTicker value={value} />
      </p>
    </div>
  )
}
