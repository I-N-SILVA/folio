import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { createServerSupabase } from '@/lib/supabase-server'
import { ViewerChrome } from '@/components/viewer/ViewerChrome'
import type { Book } from '@/lib/book-schema'
import demoBook from '@/data/books/demo-book/book.json'

interface Props {
  params: Promise<{ slug: string }>
}

async function getBook(slug: string): Promise<Book | null> {
  // Serve demo book without Supabase
  if (slug === 'demo') return demoBook as unknown as Book

  const supabase = await createServerSupabase()
  const { data: book } = await supabase
    .from('books')
    .select('*, pages(*)')
    .eq('slug', slug)
    .eq('settings->>published', 'true')
    .single()

  if (!book) return null

  // Sort pages by page_number
  if (book.pages) {
    book.pages.sort((a: any, b: any) => a.page_number - b.page_number)
  }

  return book as unknown as Book
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params
  const book = await getBook(slug)
  if (!book) return { title: 'Book Not Found' }

  const coverPage = book.pages?.[0]
  const coverImage = coverPage?.blocks.find((b: any) => b.type === 'image')

  return {
    title: book.title,
    description: book.description ?? `Read "${book.title}" on Folio`,
    openGraph: {
      title: book.title,
      description: book.description ?? `Read "${book.title}" on Folio`,
      images: coverImage ? [{ url: (coverImage as any).src }] : [],
    },
  }
}

// Revalidate public book pages every 60 seconds (ISR)
export const revalidate = 60

export default async function BookPage({ params }: Props) {
  const { slug } = await params
  const book = await getBook(slug)

  if (!book) notFound()

  if (!book.settings.published && slug !== 'demo') {
    return (
      <main className="min-h-screen flex items-center justify-center p-8">
        <div className="text-center max-w-md">
          <h1 className="text-2xl font-bold mb-3">This book isn't published yet</h1>
          <p className="text-gray-600">Check back later — the creator is still working on it.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-gray-100">
      <ViewerChrome book={book} />
    </main>
  )
}
