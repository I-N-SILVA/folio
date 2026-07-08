import { notFound } from 'next/navigation'
import { Metadata } from 'next'
import { createServerSupabase } from '@/lib/supabase-server'
import { ViewerChrome } from '@/components/viewer/ViewerChrome'
import type { Book } from '@/lib/book-schema'
import { getDemoBook } from '@/data/books'

interface Props {
  params: Promise<{ slug: string }>
}

async function getBook(slug: string): Promise<Book | null> {
  // Serve bundled demo editions without Supabase
  const demo = getDemoBook(slug)
  if (demo) return demo

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
  const description = seo?.description || book.description || `Read "${book.title}" on QLICO`

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
      <main className="qlico-grain flex min-h-screen items-center justify-center bg-[var(--background)] p-8 text-[var(--qlico-ink)]">
        <div className="max-w-md rounded-[2rem] border border-[var(--qlico-border)] bg-[#ffffff]/80 p-8 text-center shadow-[var(--qlico-shadow)]">
          <h1 className="font-display mb-3 text-4xl font-semibold tracking-[-0.06em]">Still in the bindery.</h1>
          <p className="text-[var(--qlico-muted)]">Check back later. The creator is still working on it.</p>
        </div>
      </main>
    )
  }

  // Ambient theming — the reader chrome takes a subtle tint from the cover.
  const cover = book.pages?.[0]?.background?.color || book.theme?.background || '#f5f5f7'
  const tint = /^#[0-9a-f]{6}$/i.test(cover) ? `${cover}38` : 'rgba(0,0,0,0.04)'

  return (
    <main
      className="qlico-grain flex min-h-screen flex-col items-center justify-center p-6 sm:p-12 lg:p-16"
      style={{ background: `radial-gradient(circle at 50% -8%, ${tint} 0%, #f5f5f7 55%, #ececef 100%)` }}
    >
      <ViewerChrome book={book} />
    </main>
  )
}
