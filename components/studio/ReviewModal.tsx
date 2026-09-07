'use client'

import { useCallback, useEffect, useState } from 'react'
import { Check, Copy, Link2, Loader2, MessageSquare, Undo2, X } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { Modal } from '@/components/ui/Modal'
import { useEditorStore } from '@/lib/editor-store'
import { relativeTime } from '@/lib/versions'

type Comment = {
  id: string
  page_number: number
  author_name: string
  body: string
  resolved_at: string | null
  created_at: string
}

type ReviewLink = {
  id: string
  label: string | null
  created_at: string
  expires_at: string | null
  revoked_at: string | null
  path: string
}

/**
 * What reviewers said, and who can still say it.
 *
 * Two halves on purpose. The comments are the point; the links are the thing
 * people forget they handed out, so they are visible in the same place rather
 * than in a settings screen nobody opens. A revoked link stays listed — the
 * question "did I turn that off?" needs an answer, and an empty list is not one.
 */
export function ReviewModal({ bookId, onClose }: { bookId: string; onClose: () => void }) {
  const [comments, setComments] = useState<Comment[] | null>(null)
  const [links, setLinks] = useState<ReviewLink[]>([])
  const [busy, setBusy] = useState<string | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const setCurrentPageIndex = useEditorStore((s) => s.setCurrentPageIndex)

  const load = useCallback(
    async (live: () => boolean = () => true) => {
      try {
        const [c, l] = await Promise.all([
          fetch(`/api/books/${bookId}/comments`).then((r) => r.json()),
          fetch(`/api/books/${bookId}/review-links`).then((r) => r.json()),
        ])
        if (!live()) return
        setError(null)
        setComments(c.comments ?? [])
        setLinks(l.links ?? [])
      } catch {
        if (live()) {
          setError('Could not load the review activity.')
          setComments([])
        }
      }
    },
    [bookId]
  )

  useEffect(() => {
    let live = true
    void load(() => live)
    return () => {
      live = false
    }
  }, [load])

  async function createLink() {
    setBusy('new-link')
    try {
      const res = await fetch(`/api/books/${bookId}/review-links`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      })
      if (!res.ok) throw new Error((await res.json()).error ?? 'Could not create a link.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create a link.')
    } finally {
      setBusy(null)
    }
  }

  async function revoke(link: ReviewLink) {
    setBusy(link.id)
    try {
      const res = await fetch(`/api/books/${bookId}/review-links/${link.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Could not revoke that link.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not revoke that link.')
    } finally {
      setBusy(null)
    }
  }

  async function setResolved(comment: Comment, resolved: boolean) {
    setBusy(comment.id)
    try {
      const res = await fetch(`/api/books/${bookId}/comments/${comment.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ resolved }),
      })
      if (!res.ok) throw new Error('Could not update that comment.')
      await load()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update that comment.')
    } finally {
      setBusy(null)
    }
  }

  async function copy(link: ReviewLink) {
    const url = `${window.location.origin}${link.path}`
    try {
      await navigator.clipboard.writeText(url)
      setCopied(link.id)
      setTimeout(() => setCopied(null), 1500)
    } catch {
      // Clipboard refused (an insecure origin, or a browser prompt declined).
      // The link is still selectable in the field beside the button.
      setError('Copy the link from the field — the browser would not do it.')
    }
  }

  const open = (comments ?? []).filter((c) => !c.resolved_at)
  const done = (comments ?? []).filter((c) => c.resolved_at)

  return (
    <Modal onClose={onClose} title="Review">
      {error && (
        <p className="mb-4 rounded-lg border border-red-900/60 bg-red-950/40 px-3 py-2 text-xs text-red-200">
          {error}
        </p>
      )}

      <section>
        <div className="flex items-center justify-between gap-4">
          <p className="text-sm leading-6 text-neutral-400">
            Send a link to anyone. They do not need an account, and what they leave lands here.
          </p>
          <button
            onClick={createLink}
            disabled={busy !== null}
            className="shrink-0 flex items-center gap-1.5 rounded-lg border border-neutral-700 bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-50"
          >
            {busy === 'new-link' ? (
              <Loader2 size={13} className="animate-spin" />
            ) : (
              <Link2 size={13} />
            )}
            New review link
          </button>
        </div>

        {links.length > 0 && (
          <ul className="mt-3 space-y-1.5">
            {links.map((l) => {
              const dead =
                Boolean(l.revoked_at) ||
                (l.expires_at != null && new Date(l.expires_at) < new Date())
              return (
                <li
                  key={l.id}
                  className={twMerge(
                    'flex items-center gap-2 rounded-xl border border-neutral-800 bg-neutral-900/70 px-3 py-2',
                    dead && 'opacity-50'
                  )}
                >
                  <input
                    readOnly
                    value={l.path}
                    onFocus={(e) => e.currentTarget.select()}
                    className="min-w-0 flex-1 truncate bg-transparent font-mono text-[11px] text-neutral-300 outline-none"
                  />
                  <span className="shrink-0 text-[11px] text-neutral-400">
                    {l.revoked_at
                      ? 'revoked'
                      : l.expires_at
                        ? `expires ${relativeTime(l.expires_at).replace(' ago', ' from now')}`
                        : 'no expiry'}
                  </span>
                  {!dead && (
                    <>
                      <button
                        onClick={() => void copy(l)}
                        className="shrink-0 rounded-md p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100"
                        title="Copy link"
                      >
                        {copied === l.id ? <Check size={13} /> : <Copy size={13} />}
                      </button>
                      <button
                        onClick={() => void revoke(l)}
                        disabled={busy !== null}
                        className="shrink-0 rounded-md p-1.5 text-neutral-400 transition hover:bg-neutral-800 hover:text-neutral-100 disabled:opacity-50"
                        title="Revoke"
                      >
                        <X size={13} />
                      </button>
                    </>
                  )}
                </li>
              )
            })}
          </ul>
        )}
      </section>

      <section className="mt-6">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.14em] text-neutral-400">
          {open.length} open
        </h3>
        <div className="mt-2 max-h-[38vh] space-y-1.5 overflow-y-auto custom-scrollbar pr-1">
          {comments === null && (
            <p className="py-8 text-center text-xs text-neutral-400">Reading the comments…</p>
          )}
          {comments?.length === 0 && (
            <p className="py-8 text-center text-xs text-neutral-400">
              Nothing yet. Send a link and it will show up here.
            </p>
          )}
          {[...open, ...done].map((c) => (
            <div
              key={c.id}
              className={twMerge(
                'rounded-xl border border-neutral-800 bg-neutral-900/70 px-3 py-2.5',
                c.resolved_at && 'opacity-60'
              )}
            >
              <div className="flex items-center gap-2">
                <MessageSquare size={13} className="shrink-0 text-neutral-400" />
                <button
                  onClick={() => {
                    setCurrentPageIndex(c.page_number - 1)
                    onClose()
                  }}
                  className="text-xs font-semibold text-neutral-100 underline-offset-2 hover:underline"
                >
                  Page {c.page_number}
                </button>
                <span className="min-w-0 flex-1 truncate text-[11px] text-neutral-400">
                  {c.author_name} · {relativeTime(c.created_at)}
                </span>
                <button
                  onClick={() => void setResolved(c, !c.resolved_at)}
                  disabled={busy !== null}
                  className="shrink-0 flex items-center gap-1 rounded-md border border-neutral-700 px-2 py-1 text-[11px] font-semibold text-neutral-200 transition hover:bg-neutral-800 disabled:opacity-50"
                >
                  {busy === c.id ? (
                    <Loader2 size={11} className="animate-spin" />
                  ) : c.resolved_at ? (
                    <Undo2 size={11} />
                  ) : (
                    <Check size={11} />
                  )}
                  {c.resolved_at ? 'Reopen' : 'Resolve'}
                </button>
              </div>
              <p className="mt-1.5 whitespace-pre-wrap text-sm leading-6 text-neutral-200">
                {c.body}
              </p>
            </div>
          ))}
        </div>
      </section>
    </Modal>
  )
}
