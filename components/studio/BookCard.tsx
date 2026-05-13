'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BarChart2, ExternalLink, Trash2, Edit2, Check, X, MoreVertical } from 'lucide-react'
import { toast } from 'sonner'

interface BookCardProps {
  book: any
}

export function BookCard({ book: initialBook }: BookCardProps) {
  const [book, setBook] = useState(initialBook)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [newTitle, setNewTitle] = useState(book.title)
  const router = useRouter()

  const published = book.settings?.published

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
    <div className={`bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-all ${isDeleting ? 'opacity-50 grayscale' : ''}`}>
      <div className="flex items-start justify-between mb-3 gap-2">
        {isEditing ? (
          <div className="flex-1 flex items-center gap-1">
            <input
              autoFocus
              className="flex-1 text-sm font-semibold text-gray-900 border-b-2 border-[#01696F] outline-none py-0.5"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleRename()
                if (e.key === 'Escape') setIsEditing(false)
              }}
            />
            <button onClick={handleRename} className="p-1 text-green-600 hover:bg-green-50 rounded">
              <Check size={14} />
            </button>
            <button onClick={() => setIsEditing(false)} className="p-1 text-gray-400 hover:bg-gray-50 rounded">
              <X size={14} />
            </button>
          </div>
        ) : (
          <h2 className="font-semibold text-gray-900 truncate flex-1" title={book.title}>
            {book.title}
          </h2>
        )}
        
        {!isEditing && (
          <span
            className={`text-[10px] px-2 py-0.5 rounded-full font-bold uppercase tracking-wider flex-shrink-0 ${
              published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
            }`}
          >
            {published ? 'Published' : 'Draft'}
          </span>
        )}
      </div>

      <p className="text-xs text-gray-400 mb-4">
        {new Date(book.updated_at || book.created_at).toLocaleDateString()} • {book.pages?.length || 0} pages
      </p>

      <div className="flex items-center gap-2 mt-auto">
        <Link
          href={`/editor/${book.id}`}
          className="flex-1 text-center text-sm bg-[#01696F] text-white py-2 rounded-lg transition-all hover:opacity-90 font-medium"
        >
          Edit
        </Link>

        {published && (
          <Link
            href={`/book/${book.slug}`}
            target="_blank"
            className="p-2 text-gray-500 hover:text-[#01696F] hover:bg-[#01696F]/5 rounded-lg transition-colors"
            aria-label="View live"
          >
            <ExternalLink size={18} />
          </Link>
        )}

        <Link
          href={`/analytics/${book.slug}`}
          className="p-2 text-gray-500 hover:text-[#01696F] hover:bg-[#01696F]/5 rounded-lg transition-colors"
          aria-label="Analytics"
        >
          <BarChart2 size={18} />
        </Link>

        <div className="h-4 w-px bg-gray-100 mx-1" />

        <button
          onClick={() => setIsEditing(true)}
          className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          aria-label="Rename"
        >
          <Edit2 size={16} />
        </button>

        <button
          disabled={isDeleting}
          onClick={handleDelete}
          className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          aria-label="Delete"
        >
          <Trash2 size={16} />
        </button>
      </div>
    </div>
  )
}
