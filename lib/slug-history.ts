import 'server-only'
import { supabaseAdmin } from '@/lib/supabase'

/**
 * Where an old link should go now.
 *
 * An edition's slug can be changed, and the address it used to have is filed in
 * `book_slug_history` so the link that is already in someone's inbox still
 * arrives. Called only on the miss path, so a normal read costs nothing.
 */
export async function findCurrentSlug(oldSlug: string): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from('book_slug_history')
    .select('book_id')
    .eq('slug', oldSlug)
    .maybeSingle()

  if (error) {
    // 42P01 = undefined_table: book_slug_history lands in 009. A 404 is the
    // correct answer on such an install — no slug has ever been changed there.
    if (error.code !== '42P01') {
      console.error('[slug-history] lookup failed:', error)
    }
    return null
  }
  if (!data) return null

  const { data: book } = await supabaseAdmin
    .from('books')
    .select('slug')
    .eq('id', data.book_id)
    .maybeSingle()

  // Guard against pointing an old link at itself. If the edition somehow holds
  // the historical slug again, redirecting would loop forever.
  if (!book?.slug || book.slug === oldSlug) return null
  return book.slug as string
}
