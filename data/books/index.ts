import type { Book } from '@/lib/book-schema'
import demoBook from './demo-book/book.json'
import lookbook from './demo-lookbook/book.json'
import report from './demo-report/book.json'
import portfolio from './demo-portfolio/book.json'

// Bundled demo editions, served without Supabase so the "wow" works on a
// fresh deploy (and offline). Keyed by public slug.
export const DEMO_BOOKS: Record<string, Book> = {
  demo: demoBook as unknown as Book,
  'demo-lookbook': lookbook as unknown as Book,
  'demo-report': report as unknown as Book,
  'demo-portfolio': portfolio as unknown as Book,
}

export function getDemoBook(slug: string): Book | null {
  return DEMO_BOOKS[slug] ?? null
}
