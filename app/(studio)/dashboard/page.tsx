import Link from 'next/link'
import { Plus } from 'lucide-react'
import { createServerSupabase } from '@/lib/supabase-server'
import { DashboardActions } from '@/components/studio/DashboardActions'
import { BookCard } from '@/components/studio/BookCard'

async function getBooks() {
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []

  const { data } = await supabase
    .from('books')
    .select('*, pages(id)')
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
          <div className="text-center py-20 bg-white rounded-2xl border border-gray-100 shadow-sm">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
              <Plus size={32} className="text-gray-300" />
            </div>
            <h2 className="text-lg font-bold text-gray-900 mb-1">Your digital shelf is empty</h2>
            <p className="text-gray-500 text-sm mb-8 max-w-xs mx-auto">Create interactive portfolios and magazines that look stunning on any device.</p>
            <DashboardActions />
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {books.map((book: any) => (
              <BookCard key={book.id} book={book} />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
