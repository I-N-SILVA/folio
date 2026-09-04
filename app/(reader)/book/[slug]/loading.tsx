import { BookSkeleton } from '@/components/viewer/BookSkeleton'

/**
 * What a stranger sees for the first second of the product.
 *
 * The dashboard, the editor and the analytics dashboard all had a loading
 * state; the reader — the one surface someone meets before they know what
 * QLICO is, usually from a link, often on a phone on mobile data — had none,
 * and rendered nothing at all until the server answered. `BookSkeleton` was
 * written for exactly this and nothing ever imported it.
 *
 * It shows a page-shaped pair at the reader's own 1:1.41 ratio, so the first
 * frame is the shape of the thing that is about to arrive rather than a blank
 * screen or a spinner.
 */
export default function BookLoading() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--qlico-subtle)] p-6">
      <BookSkeleton />
    </main>
  )
}
