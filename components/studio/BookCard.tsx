'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BarChart2, ExternalLink, Trash2, Edit2, Check, X } from 'lucide-react'
import { toast } from 'sonner'
import type { Book } from '@/lib/book-schema'

interface BookCardProps {
  book: Omit<Book, 'pages'> & { pages?: { id: string }[] }
}

export function BookCard({ book: initialBook }: BookCardProps) {
  const [book, setBook] = useState(initialBook)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [newTitle, setNewTitle] = useState(book.title)
  const router = useRouter()

  const published = book.settings?.published
  const displayDate = book.updated_at || book.created_at || new Date().toISOString()

  const handleDelete = async () => {
    if (!confirm(`Are you sure you want to delete "${book.title}"?`)) return

    setIsDeleting(true)
    try {
      const res = await fetch(`/api/books/${book.id}`, { method: 'DELETE' })
      if (!res.ok) throw new Error('Failed to delete book')
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
    <article className={`group relative overflow-hidden rounded-[2rem] border border-[var(--folio-border)] bg-[#fffaf0]/78 p-5 shadow-sm transition-all hover:-translate-y-1 hover:bg-white hover:shadow-[0_24px_60px_rgba(43,31,18,0.14)] ${isDeleting ? 'opacity-50 grayscale' : ''}`}>
      <div className="absolute -right-10 -top-12 h-28 w-28 rounded-full bg-[rgba(185,130,53,0.18)] blur-2xl transition group-hover:bg-[rgba(13,102,97,0.16)]" />
      <div className="flex items-start justify-between mb-3 gap-2">
        {isEditing ? (
          <div className="flex-1 flex items-center gap-1">
            <input
              autoFocus
              className="flex-1 border-b-2 border-[var(--folio-teal)] bg-transparent py-0.5 text-sm font-semibold text-[var(--folio-ink)] outline-none"
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
            <button onClick={() => setIsEditing(false)} className="rounded p-1 text-[var(--folio-muted)] hover:bg-black/5">
              <X size={14} />
            </button>
          </div>
        ) : (
          <h2 className="font-display flex-1 truncate text-2xl font-semibold tracking-[-0.05em] text-[var(--folio-ink)]" title={book.title}>
            {book.title}
          </h2>
        )}
        
        {!isEditing && (
          <span
            className={`flex-shrink-0 rounded-full px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-[0.16em] ${
              published ? 'bg-[#dcebd7] text-[#3d6c38]' : 'bg-black/5 text-[var(--folio-muted)]'
            }`}
          >
            {published ? 'Published' : 'Draft'}
          </span>
        )}
      </div>

      <p className="mb-5 text-xs font-semibold uppercase tracking-[0.14em] text-[var(--folio-muted)]">
        {new Date(displayDate).toLocaleDateString()} / {book.pages?.length || 0} pages
      </p>

      <div className="flex items-center gap-2 mt-auto">
        <Link
          href={`/editor/${book.id}`}
          className="flex-1 rounded-full bg-[var(--folio-ink)] py-2.5 text-center text-sm font-extrabold text-[#fbf1df] transition-all hover:-translate-y-0.5 hover:bg-[var(--folio-teal)]"
        >
          Edit
        </Link>

        {published && (
          <Link
            href={`/book/${book.slug}`}
            target="_blank"
            className="rounded-full p-2.5 text-[var(--folio-muted)] transition-colors hover:bg-[var(--folio-teal)]/10 hover:text-[var(--folio-teal)]"
            aria-label="View live"
          >
            <ExternalLink size={18} />
          </Link>
        )}

        <Link
          href={`/analytics/${book.slug}`}
          className="rounded-full p-2.5 text-[var(--folio-muted)] transition-colors hover:bg-[var(--folio-teal)]/10 hover:text-[var(--folio-teal)]"
          aria-label="Analytics"
        >
          <BarChart2 size={18} />
        </Link>

        <div className="mx-1 h-4 w-px bg-[var(--folio-border)]" />

        <button
          onClick={() => setIsEditing(true)}
          className="rounded-full p-2.5 text-[var(--folio-muted)] transition-colors hover:bg-blue-50 hover:text-blue-700"
          aria-label="Rename"
        >
          <Edit2 size={16} />
        </button>

        <button
          disabled={isDeleting}
          onClick={handleDelete}
          className="rounded-full p-2.5 text-[var(--folio-muted)] transition-colors hover:bg-red-50 hover:text-red-700"
          aria-label="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </article>
  )
}
