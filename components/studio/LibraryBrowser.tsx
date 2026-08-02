'use client'

import { useMemo, useState } from 'react'
import { LibraryBig, Search, X } from 'lucide-react'
import { BookCard } from './BookCard'
import Reveal from '@/components/landing/Reveal'
import type { Book, Page } from '@/lib/book-schema'

type LibraryBook = Omit<Book, 'pages'> & { pages?: { id: string }[]; cover?: Page | null }

type Filter = 'all' | 'published' | 'draft'
type Sort = 'recent' | 'created' | 'title'

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'published', label: 'Published' },
  { value: 'draft', label: 'Drafts' },
]

const SORTS: { value: Sort; label: string }[] = [
  { value: 'recent', label: 'Recently updated' },
  { value: 'created', label: 'Newest first' },
  { value: 'title', label: 'Title A–Z' },
]

/**
 * The library was an unsorted, unsearchable grid. That's fine at three books
 * and unusable at thirty — and a paid plan exists specifically to let people
 * pass thirty. Controls only appear once there's enough to warrant them.
 */
export function LibraryBrowser({ books }: { books: LibraryBook[] }) {
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<Filter>('all')
  const [sort, setSort] = useState<Sort>('recent')

  const showControls = books.length > 3

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase()

    const matched = books.filter((book) => {
      if (filter === 'published' && !book.settings?.published) return false
      if (filter === 'draft' && book.settings?.published) return false
      if (!needle) return true
      return (
        book.title.toLowerCase().includes(needle) ||
        (book.description ?? '').toLowerCase().includes(needle) ||
        (book.slug ?? '').toLowerCase().includes(needle)
      )
    })

    const time = (value?: string | null) => (value ? new Date(value).getTime() : 0)

    return [...matched].sort((a, b) => {
      if (sort === 'title') return a.title.localeCompare(b.title)
      if (sort === 'created') return time(b.created_at) - time(a.created_at)
      return time(b.updated_at || b.created_at) - time(a.updated_at || a.created_at)
    })
  }, [books, query, filter, sort])

  return (
    <section>
      <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-[0.18em] text-[var(--qlico-muted)]">
          <LibraryBig size={16} />
          Library
          <span className="font-normal normal-case tracking-normal">
            ({visible.length}
            {visible.length !== books.length ? ` of ${books.length}` : ''})
          </span>
        </h2>

        {showControls && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
            <div className="relative">
              <Search
                size={15}
                className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[var(--qlico-muted)]"
                aria-hidden="true"
              />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search editions…"
                aria-label="Search editions"
                className="w-full rounded-full border border-[var(--qlico-border)] bg-white/70 py-2.5 pl-9 pr-9 text-sm outline-none transition focus:border-[var(--accent)] focus:ring-2 focus:ring-[var(--accent)]/15 sm:w-56"
              />
              {query && (
                <button
                  type="button"
                  onClick={() => setQuery('')}
                  aria-label="Clear search"
                  className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-full text-[var(--qlico-muted)] transition hover:bg-black/5"
                >
                  <X size={13} />
                </button>
              )}
            </div>

            <div
              role="group"
              aria-label="Filter by status"
              className="flex rounded-full border border-[var(--qlico-border)] bg-white/70 p-1"
            >
              {FILTERS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setFilter(option.value)}
                  aria-pressed={filter === option.value}
                  className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                    filter === option.value
                      ? 'bg-[var(--accent)] text-white'
                      : 'text-[var(--qlico-muted)] hover:text-[var(--qlico-ink)]'
                  }`}
                >
                  {option.label}
                </button>
              ))}
            </div>

            <label className="sr-only" htmlFor="library-sort">
              Sort editions
            </label>
            <select
              id="library-sort"
              value={sort}
              onChange={(e) => setSort(e.target.value as Sort)}
              className="rounded-full border border-[var(--qlico-border)] bg-white/70 px-3 py-2.5 text-xs font-semibold text-[var(--qlico-ink)] outline-none transition focus:border-[var(--accent)]"
            >
              {SORTS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {visible.length === 0 ? (
        <div className="rounded-[2rem] border border-dashed border-[var(--qlico-border)] bg-white/50 px-6 py-16 text-center">
          <p className="font-display text-2xl font-semibold tracking-[-0.03em]">No matches</p>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-6 text-[var(--qlico-muted)]">
            Nothing in your library fits that search and filter.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery('')
              setFilter('all')
            }}
            className="mt-5 rounded-full border border-[var(--qlico-border)] bg-white px-5 py-2.5 text-sm font-semibold transition hover:bg-[var(--qlico-subtle)]"
          >
            Clear filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {visible.map((book, i) => (
            <Reveal key={book.id} delay={(i % 3) * 70}>
              <BookCard book={book} />
            </Reveal>
          ))}
        </div>
      )}
    </section>
  )
}
