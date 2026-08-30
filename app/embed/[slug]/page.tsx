import { notFound, permanentRedirect } from 'next/navigation'
import type { Metadata } from 'next'
import { createServerSupabase } from '@/lib/supabase-server'
import { ViewerChrome } from '@/components/viewer/ViewerChrome'
import type { Book } from '@/lib/book-schema'
import { getDemoBook } from '@/data/books'
import { applyGate } from '@/lib/gating'
import { getOwnerEntitlements, readerPolicy } from '@/lib/entitlements'
import { findCurrentSlug } from '@/lib/slug-history'
import { PLANS } from '@/lib/plans'

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
  if (!book) {
    // An embed snippet lives in someone else's HTML and is the least likely
    // thing to get updated after a rename, so it needs the forward most.
    const current = await findCurrentSlug(slug)
    if (current) permanentRedirect(`/embed/${current}`)
    notFound()
  }

  // Same plan resolution as the canonical reader — an embed is the same content
  // at a different URL, so it must not be a way around the badge or the gate.
  const entitlements = getDemoBook(slug)
    ? PLANS.pro.entitlements
    : await getOwnerEntitlements(book.owner_id)
  const { showBadge, gateEnabled } = readerPolicy(book.settings, entitlements)

  const { book: visible, lockedCount } = applyGate(book, gateEnabled)

  return (
    <main className="flex h-screen w-full items-center justify-center overflow-hidden bg-transparent">
      <ViewerChrome book={visible} lockedCount={lockedCount} showBadge={showBadge} embed />
    </main>
  )
}
