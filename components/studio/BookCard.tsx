'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BarChart2, BookOpen, ExternalLink, Share2, Trash2, Edit2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import { ConfirmDialog } from '@/components/ui/Modal'
import { ShareModal } from './ShareModal'
import { PageRenderer } from '@/components/viewer/PageRenderer'
import type { Book, Page } from '@/lib/book-schema'
import { PAGE_ASPECT, PAGE_DESIGN_HEIGHT, PAGE_DESIGN_WIDTH, pageScale } from '@/lib/page-geometry'

interface BookCardProps {
  book: Omit<Book, 'pages'> & { pages?: { id: string }[]; cover?: Page | null }
}

/**
 * A shelf of interactive editions was rendering as a wall of text. This is the
 * same scaled-render trick the editor's page rail uses: lay the real page out
 * at its design width, then transform it down. No thumbnail pipeline needed,
 * and it can never drift from what the page actually looks like.
 */

function CoverPreview({
  cover,
  title,
  href,
}: {
  cover?: Page | null
  title: string
  href: string
}) {
  const frameRef = useRef<HTMLDivElement>(null)
  const [scale, setScale] = useState(0)
  const [nearViewport, setNearViewport] = useState(false)

  // The card width is fluid, so the shrink factor has to be measured. CSS
  // can't express "divide a length by a length" portably yet.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    const obs = new ResizeObserver(([entry]) => {
      setScale(pageScale(entry.contentRect.width))
    })
    obs.observe(frame)
    return () => obs.disconnect()
  }, [])

  // A cover page is a real page: it can hold an embed (an iframe) or audio
  // (which preloads metadata). Mounting every card's page at once would make
  // a large library open dozens of them, so hold off until each is close to
  // being seen.
  useEffect(() => {
    const frame = frameRef.current
    if (!frame) return
    if (typeof IntersectionObserver === 'undefined') {
      setNearViewport(true)
      return
    }
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNearViewport(true)
          obs.disconnect()
        }
      },
      { rootMargin: '400px' }
    )
    obs.observe(frame)
    return () => obs.disconnect()
  }, [])

  return (
    // Presented as a book: portrait, capped so cards stay a sane height, with
    // a spine edge and lift so a shelf of these reads as objects rather than
    // cropped screenshots.
    <div className="mb-5 flex justify-center">
      <div
        ref={frameRef}
        style={{ aspectRatio: PAGE_ASPECT }}
        // The ring uses the border token rather than the hairline so a dark
        // cover still reads as an object against a dark card.
        className="relative w-full max-w-[188px] overflow-hidden rounded-r-[5px] rounded-l-[2px] bg-[var(--qlico-vellum)] shadow-[0_1px_2px_rgba(20,26,58,0.18),0_10px_24px_-8px_rgba(20,26,58,0.28),0_28px_50px_-28px_rgba(20,26,58,0.35)] ring-1 ring-[var(--qlico-border)] transition-transform duration-300 group-hover:-translate-y-0.5"
      >
      {cover && nearViewport ? (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute left-0 top-0 origin-top-left transition-opacity"
          style={{
            width: PAGE_DESIGN_WIDTH,
            height: PAGE_DESIGN_HEIGHT,
            transform: `scale(${scale})`,
            // Hide the un-scaled flash before the first measurement lands.
            opacity: scale > 0 ? 1 : 0,
          }}
        >
          <PageRenderer page={cover} bookId={cover.book_id} className="h-full w-full" />
        </div>
      ) : cover ? null : (
        <div className="absolute inset-0 grid place-items-center text-[var(--qlico-muted)]">
          <BookOpen size={28} strokeWidth={1.5} className="opacity-50" />
        </div>
      )}

        {/* Spine shading along the bound edge. */}
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-y-0 left-0 z-[5] w-3"
          style={{
            background:
              'linear-gradient(to right, rgba(20,26,58,0.16), rgba(20,26,58,0.05) 45%, transparent)',
          }}
        />

        {/* A sibling of the rendered page, never an ancestor: pages can contain
            button blocks, which are anchors, and an anchor inside an anchor is
            invalid HTML the parser silently restructures. */}
        <Link
          href={href}
          tabIndex={-1}
          aria-hidden="true"
          className="absolute inset-0 z-10 transition-colors hover:bg-[var(--accent)]/5"
        >
          <span className="sr-only">{`Open ${title}`}</span>
        </Link>
      </div>
    </div>
  )
}

export function BookCard({ book: initialBook }: BookCardProps) {
  const [book, setBook] = useState(initialBook)
  const [isDeleting, setIsDeleting] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [showShare, setShowShare] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [newTitle, setNewTitle] = useState(book.title)
  const router = useRouter()

  const published = book.settings?.published
  const displayDate = book.updated_at || book.created_at || new Date().toISOString()

  const handleDelete = async () => {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/books/${book.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete book')
      setConfirmDelete(false)
      toast.success('Book deleted')
      router.refresh()
    } catch (err: any) {
      toast.error(err.message)
      setIsDeleting(false)
    }
  }

  const handleRename = async () => {
    if (!newTitle.trim() || newTitle === book.title) {
      setIsEditing(false)
      return
    }

    try {
      const res = await fetch(`/api/books/${book.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title: newTitle.trim() }),
      })

      if (!res.ok) throw new Error('Failed to rename book')
      
      const updated = await res.json()
      setBook(updated)
      setIsEditing(false)
      toast.success('Book renamed')
    } catch (err: any) {
      toast.error(err.message)
    }
  }

  return (
    <article className={`group relative overflow-hidden rounded-[2rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/78 p-5 shadow-sm transition-all duration-300 hover:-translate-y-1 hover:bg-[var(--qlico-paper)] hover:shadow-[0_24px_60px_rgba(0,0,0,0.10)] ${isDeleting ? 'opacity-50 grayscale' : ''}`}>
      <div className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-[rgba(60,35,132,0.10)] blur-2xl transition group-hover:bg-[rgba(60,35,132,0.18)]" />

      <CoverPreview
        cover={initialBook.cover}
        title={book.title}
        href={`/editor/${book.id}`}
      />

      <div className="flex items-start justify-between mb-3 gap-2">
        {isEditing ? (
          <div className="flex-1 flex items-center gap-1">
            <input
              autoFocus
              className="flex-1 border-b-2 border-[var(--qlico-teal)] bg-transparent py-0.5 text-sm font-semibold text-[var(--qlico-ink)] outline-none"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setIsEditing(false)
              }}
            />
            <button onClick={handleRename} className="rounded p-1 text-green-700 hover:bg-green-50">
              <Check size={14} />
            </button>
            <button onClick={() => setIsEditing(false)} className="rounded p-1 text-[var(--qlico-muted)] hover:bg-[var(--tint-weak)]">
              <X size={14} />
            </button>
          </div>
        ) : (
          <h2 className="font-display flex-1 truncate text-2xl font-semibold tracking-[-0.05em] text-[var(--qlico-ink)]" title={book.title}>
            {book.title}
          </h2>
        )}
        
        {!isEditing && (
          <span
            className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${
              published ? 'bg-[#dcebd7] text-[#3d6c38]' : 'bg-[var(--tint-weak)] text-[var(--qlico-muted)]'
            }`}
          >
            {published ? 'Published' : 'Draft'}
          </span>
        )}
      </div>

      <p className="mb-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--qlico-muted)]">
        {new Date(displayDate).toLocaleDateString()} / {book.pages?.length || 0} pages
      </p>

      <div className="flex items-center gap-2 mt-auto">
        <Link
          href={`/editor/${book.id}`}
          className="flex-1 rounded-full bg-[var(--btn-solid)] py-2.5 text-center text-sm font-semibold text-[var(--accent-contrast)] transition-all hover:-translate-y-0.5 hover:bg-[var(--btn-solid-hover)]"
        >
          Edit
        </Link>

        {published && (
          <Link
            href={`/book/${book.slug}`}
            target="_blank"
            className="rounded-full p-2.5 text-[var(--qlico-muted)] transition-colors hover:bg-[var(--qlico-teal)]/10 hover:text-[var(--qlico-teal)]"
            aria-label="View live"
          >
            <ExternalLink size={18} />
          </Link>
        )}

        <button
          onClick={() => setShowShare(true)}
          className="rounded-full p-2.5 text-[var(--qlico-muted)] transition-colors hover:bg-[var(--accent)]/10 hover:text-[var(--accent-fg)]"
          aria-label={`Share ${book.title}`}
        >
          <Share2 size={18} />
        </button>

        <Link
          href={`/analytics/${book.slug}`}
          className="rounded-full p-2.5 text-[var(--qlico-muted)] transition-colors hover:bg-[var(--qlico-teal)]/10 hover:text-[var(--qlico-teal)]"
          aria-label="Analytics"
        >
          <BarChart2 size={18} />
        </Link>

        <div className="mx-1 h-4 w-px bg-[var(--qlico-border)]" />

        <button
          onClick={() => setIsEditing(true)}
          className="rounded-full p-2.5 text-[var(--qlico-muted)] transition-colors hover:bg-blue-50 hover:text-blue-700"
          aria-label="Rename"
        >
          <Edit2 size={16} />
        </button>

        <button
          disabled={isDeleting}
          onClick={() => setConfirmDelete(true)}
          className="rounded-full p-2.5 text-[var(--qlico-muted)] transition-colors hover:bg-red-50 hover:text-red-700"
          aria-label={`Delete ${book.title}`}
        >
          <Trash2 size={16} />
        </button>
      </div>

      {showShare && (
        <ShareModal
          slug={book.slug}
          published={Boolean(published)}
          onClose={() => setShowShare(false)}
        />
      )}

      {confirmDelete && (
        <ConfirmDialog
          title="Delete this edition?"
          body={
            <>
              <strong className="font-semibold text-[var(--qlico-ink)]">{book.title}</strong> and
              all of its pages, hotspots, and analytics will be permanently removed. This can&apos;t
              be undone.
            </>
          }
          confirmLabel="Delete edition"
          destructive
          busy={isDeleting}
          onConfirm={handleDelete}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </article>
  )
}
