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

  const seo = book.settings?.seo
  const title = seo?.title || book.title
  const description = seo?.description || book.description || `Read "${book.title}" on Riffle`

  // Use the dynamic OG image generator route
  const ogImageUrl = `/book/${slug}/opengraph-image`

  return {
    title,
    description,
    keywords: seo?.keywords,
    openGraph: {
      title,
      description,
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
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
      <main className="folio-grain flex min-h-screen items-center justify-center bg-[var(--background)] p-8 text-[var(--folio-ink)]">
        <div className="max-w-md rounded-[2rem] border border-[var(--folio-border)] bg-[#ffffff]/80 p-8 text-center shadow-[var(--folio-shadow)]">
          <h1 className="font-display mb-3 text-4xl font-semibold tracking-[-0.06em]">Still in the bindery.</h1>
          <p className="text-[var(--folio-muted)]">Check back later. The creator is still working on it.</p>
        </div>
      </main>
    )
  }

  return (
    <main className="folio-grain flex min-h-screen flex-col items-center justify-center bg-[radial-gradient(circle_at_top,#ffffff_0%,#f5f5f7_45%,#ececef_100%)] p-4">
      <ViewerChrome book={book} />
    </main>
  )
}
