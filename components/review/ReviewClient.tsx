'use client'

import { useCallback, useEffect, useState } from 'react'
import { MessageSquare, Send, Loader2 } from 'lucide-react'
import { PageRenderer } from '@/components/viewer/PageRenderer'
import type { Book, Page } from '@/lib/book-schema'

type Comment = {
  id: string
  page_number: number
  author_name: string
  body: string
  resolved_at: string | null
  created_at: string
}

/** The reviewer's name, kept per browser so it is typed once, not per comment. */
const NAME_KEY = 'qlico:review_name'

/**
 * A draft, page by page, with somewhere to say something about each one.
 *
 * The review drawer this replaces kept what a reviewer typed in component state
 * and lost it on refresh. Everything here is written to the server before it is
 * acknowledged, and the draft in the box is kept in `localStorage` while it is
 * being typed — the two ways feedback used to evaporate.
 */
export function ReviewClient({ token }: { token: string }) {
  const [book, setBook] = useState<Book | null>(null)
  const [comments, setComments] = useState<Comment[]>([])
  const [error, setError] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [drafts, setDrafts] = useState<Record<number, string>>({})
  const [sending, setSending] = useState<number | null>(null)

  useEffect(() => {
    try {
      setName(localStorage.getItem(NAME_KEY) ?? '')
    } catch {
      // A private window with storage blocked: the name is simply typed again.
    }
  }, [])

  const load = useCallback(
    async (live: () => boolean = () => true) => {
      try {
        const res = await fetch(`/api/review/${token}`)
        const data = await res.json()
        if (!live()) return
        if (!res.ok) {
          setError(data.error ?? 'This review link is no longer active.')
          return
        }
        setError(null)
        setBook(data.book)
        setComments(data.comments ?? [])
      } catch {
        if (live()) setError('Could not reach the server.')
      }
    },
    [token]
  )

  useEffect(() => {
    let live = true
    void load(() => live)
    return () => {
      live = false
    }
  }, [load])

  function setDraft(pageNumber: number, value: string) {
    setDrafts((d) => ({ ...d, [pageNumber]: value }))
    try {
      localStorage.setItem(`qlico:review_draft:${token}:${pageNumber}`, value)
    } catch {
      // Nothing to do; the comment is still sendable, just not recoverable.
    }
  }

  useEffect(() => {
    if (!book?.pages) return
    try {
      const restored: Record<number, string> = {}
      for (const p of book.pages as Page[]) {
        const saved = localStorage.getItem(`qlico:review_draft:${token}:${p.page_number}`)
        if (saved) restored[p.page_number] = saved
      }
      if (Object.keys(restored).length > 0) setDrafts((d) => ({ ...restored, ...d }))
    } catch {
      // As above.
    }
  }, [book, token])

  async function send(pageNumber: number) {
    const body = (drafts[pageNumber] ?? '').trim()
    if (!body || !name.trim()) return
    setSending(pageNumber)
    try {
      const res = await fetch(`/api/review/${token}/comments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ pageNumber, authorName: name.trim(), body }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Could not save that comment.')
      setComments((c) => [...c, data])
      setDraft(pageNumber, '')
      try {
        localStorage.setItem(NAME_KEY, name.trim())
        localStorage.removeItem(`qlico:review_draft:${token}:${pageNumber}`)
      } catch {
        // As above.
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save that comment.')
    } finally {
      setSending(null)
    }
  }

  if (error && !book) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-8">
        <div className="max-w-md rounded-[2rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)] p-8 text-center">
          <h1 className="text-lg font-semibold text-[var(--qlico-ink)]">{error}</h1>
          <p className="mt-2 text-sm text-[var(--qlico-muted)]">
            Ask whoever sent it for a new one.
          </p>
        </div>
      </main>
    )
  }

  if (!book) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--background)] p-8">
        <p className="text-sm text-[var(--qlico-muted)]">Opening the draft…</p>
      </main>
    )
  }

  const pages = (book.pages ?? []) as Page[]

  return (
    <main className="min-h-screen bg-[var(--background)] px-4 py-10 text-[var(--qlico-ink)]">
      <header className="mx-auto mb-8 max-w-3xl">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-[var(--qlico-muted)]">
          Draft for review
        </p>
        <h1 className="mt-1 text-2xl font-semibold">{book.title}</h1>
        <p className="mt-2 text-sm leading-6 text-[var(--qlico-muted)]">
          Leave a note under any page. Nothing here is public, and your comments go straight to
          whoever sent you this link.
        </p>
        <label className="mt-4 block text-sm">
          <span className="text-[var(--qlico-muted)]">Your name</span>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="So they know who said it"
            className="mt-1 w-full max-w-xs rounded-lg border border-[var(--qlico-border)] bg-[var(--qlico-paper)] px-3 py-2 text-sm outline-none focus:border-[var(--qlico-ink)]"
          />
        </label>
      </header>

      {error && (
        <p className="mx-auto mb-6 max-w-3xl rounded-lg border border-red-500/40 bg-red-500/10 px-3 py-2 text-sm">
          {error}
        </p>
      )}

      <div className="mx-auto flex max-w-3xl flex-col gap-12">
        {pages.map((page) => {
          const forPage = comments.filter((c) => c.page_number === page.page_number)
          return (
            <section key={page.id ?? page.page_number}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qlico-muted)]">
                Page {page.page_number}
              </p>
              <div className="overflow-hidden rounded-2xl border border-[var(--qlico-border)] shadow-[var(--qlico-shadow)]">
                <div className="aspect-[1/1.41] w-full">
                  {/*
                    A deliberately non-UUID book id. `trackEvent` ignores
                    those (`isTrackableBook`), which is how the gallery and the
                    bundled demo render without polluting anyone's analytics —
                    and a client clicking through a draft is not a reader.
                  */}
                  <PageRenderer page={page} bookId="review" theme={book.theme} />
                </div>
              </div>

              {forPage.length > 0 && (
                <ul className="mt-3 space-y-2">
                  {forPage.map((c) => (
                    <li
                      key={c.id}
                      className="rounded-xl border border-[var(--qlico-border)] bg-[var(--qlico-vellum)] px-3 py-2"
                    >
                      <p className="text-xs font-semibold">
                        {c.author_name}
                        {c.resolved_at && (
                          <span className="ml-2 text-[10px] font-medium uppercase tracking-wide text-[var(--qlico-muted)]">
                            Resolved
                          </span>
                        )}
                      </p>
                      <p className="mt-0.5 whitespace-pre-wrap text-sm leading-6">{c.body}</p>
                    </li>
                  ))}
                </ul>
              )}

              <div className="mt-3 flex items-start gap-2">
                <MessageSquare size={15} className="mt-2.5 shrink-0 text-[var(--qlico-muted)]" />
                <textarea
                  value={drafts[page.page_number] ?? ''}
                  onChange={(e) => setDraft(page.page_number, e.target.value)}
                  rows={2}
                  placeholder={`Anything about page ${page.page_number}?`}
                  className="flex-1 resize-y rounded-lg border border-[var(--qlico-border)] bg-[var(--qlico-paper)] px-3 py-2 text-sm outline-none focus:border-[var(--qlico-ink)]"
                />
                <button
                  onClick={() => void send(page.page_number)}
                  disabled={
                    sending !== null || !name.trim() || !(drafts[page.page_number] ?? '').trim()
                  }
                  className="mt-0.5 flex items-center gap-1.5 rounded-lg bg-[var(--btn-solid)] px-3 py-2 text-sm font-semibold text-[var(--accent-contrast)] transition hover:bg-[var(--btn-solid-hover)] disabled:opacity-40"
                >
                  {sending === page.page_number ? (
                    <Loader2 size={14} className="animate-spin" />
                  ) : (
                    <Send size={14} />
                  )}
                  Send
                </button>
              </div>
            </section>
          )
        })}
      </div>
    </main>
  )
}
