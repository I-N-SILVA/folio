import { notFound } from 'next/navigation'
import { createServerSupabase } from '@/lib/supabase-server'
import { ViewerChrome } from '@/components/viewer/ViewerChrome'
import type { Book } from '@/lib/book-schema'
import demoBook from '@/data/books/demo-book/book.json'

async function getBook(slug: string): Promise<Book | null> {
  if (slug === 'demo') return demoBook as unknown as Book

  const supabase = await createServerSupabase()
  const { data: book } = await supabase
    .from('books')
    .select('*, pages(*)')
    .eq('slug', slug)
    .eq('settings->>published', 'true')
    .single()

  if (!book) return null
  if (book.pages) book.pages.sort((a: any, b: any) => a.page_number - b.page_number)
  return book as unknown as Book
}

export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const book = await getBook(slug)
  if (!book) notFound()

  return (
    <main className="w-full h-screen flex items-center justify-center overflow-hidden bg-[#f5f5f7]">
      <ViewerChrome book={book} embed />
    </main>
  )
}
