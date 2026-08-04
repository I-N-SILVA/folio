import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabase } from '@/lib/supabase-server'
import { ViewerChrome } from '@/components/viewer/ViewerChrome'
import type { Book } from '@/lib/book-schema'
import { getDemoBook } from '@/data/books'
import { applyGate } from '@/lib/gating'

async function getBook(slug: string): Promise<Book | null> {
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
  if (book.pages) book.pages.sort((a: any, b: any) => a.page_number - b.page_number)
  return book as unknown as Book
}

/**
 * Embeds are duplicates of /book/<slug> at a different URL. Without this they
 * compete with the canonical page in search results, and inherit the root
 * layout's title in browser history and screen-reader announcements.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>
}): Promise<Metadata> {
  const { slug } = await params
  const book = await getBook(slug)
  return {
    title: book ? `${book.title} — QLICO` : 'QLICO',
    robots: { index: false, follow: false },
    alternates: { canonical: `/book/${slug}` },
  }
}

export default async function EmbedPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params
  const book = await getBook(slug)
  if (!book) notFound()

  const { book: visible, lockedCount } = applyGate(book)

  return (
    <main className="flex h-screen w-full items-center justify-center overflow-hidden bg-[var(--qlico-subtle)]">
      <ViewerChrome book={visible} lockedCount={lockedCount} embed />
    </main>
  )
}
