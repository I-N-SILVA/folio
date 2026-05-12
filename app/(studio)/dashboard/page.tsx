import Link from 'next/link'
import { Plus, BarChart2, ExternalLink, Trash2 } from 'lucide-react'
import { createServerSupabase } from '@/lib/supabase-server'
import { DashboardActions } from '@/components/studio/DashboardActions'

async function getBooks() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('books')
    .select('*')
    .eq('owner_id', user.id)
    .order('created_at', { ascending: false })

  return data ?? []
}

export default async function DashboardPage() {
  const books = await getBooks()

  return (
    <main className="min-h-screen bg-[#F7F6F2] p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold">My Books</h1>
          <DashboardActions />
        </div>

        {books.length === 0 ? (
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100">
            <h2 className="text-lg font-medium mb-2">No books yet</h2>
            <p className="text-gray-500 text-sm mb-6">Create your first interactive flipbook</p>
            <Link
              href="/create"
              className="inline-flex items-center gap-2 bg-[#01696F] text-white px-5 py-2.5 rounded-lg text-sm font-medium hover:opacity-90 transition-opacity"
            >
              <Plus size={16} />
              Create Book
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {books.map((book: any) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}

function BookCard({ book }: { book: any }) {
  const published = book.settings?.published

  return (
    <div className="bg-white rounded-2xl border border-gray-100 p-5 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-3">
        <h2 className="font-semibold text-gray-900 truncate flex-1 mr-2">{book.title}</h2>
        <span
          className={`text-xs px-2 py-1 rounded-full flex-shrink-0 ${
            published ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
          }`}
        >
          {published ? 'Published' : 'Draft'}
        </span>
      </div>

      {book.description && (
        <p className="text-sm text-gray-500 mb-4 line-clamp-2">{book.description}</p>
      )}

      <div className="flex items-center gap-2 mt-auto">
        <Link
          href={`/editor/${book.id}`}
          className="flex-1 text-center text-sm bg-gray-100 hover:bg-gray-200 py-2 rounded-lg transition-colors"
        >
          Edit
        </Link>

        {published && (
          <Link
            href={`/book/${book.slug}`}
            target="_blank"
            className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
            aria-label="View live"
          >
            <ExternalLink size={16} />
          </Link>
        )}

        <Link
          href={`/analytics/${book.slug}`}
          className="p-2 text-gray-500 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
          aria-label="Analytics"
        >
          <BarChart2 size={16} />
        </Link>
      </div>
    </div>
  )
}
