import 'server-only'
import { createServerSupabase } from '@/lib/supabase-server'
import { getDemoBook } from '@/data/books'
import { findCurrentSlug } from '@/lib/slug-history'

export type ReaderSlug =
  | { status: 'found' }
  | { status: 'moved'; to: string }
  | { status: 'missing' }

/**
 * Does this reader address point at anything, and if not, where did it go?
 *
 * Deliberately reads one column. The caller runs this *before* the response
 * body starts streaming, and everything it awaits delays the first byte, so it
 * answers the cheapest question that decides the HTTP status and leaves the
 * edition itself to be fetched behind the skeleton.
 *
 * The published predicate has to agree with `getBook` in the reader page: if
 * this said "found" for a draft the page would soft-404 it anyway, and if it
 * said "missing" for something the page can render the edition would disappear.
 * `lib/reader-slug.test.ts` fails the build if the two drift apart.
 */
export async function resolveReaderSlug(slug: string): Promise<ReaderSlug> {
  if (getDemoBook(slug)) return { status: 'found' }

  const supabase = await createServerSupabase()
  const { data } = await supabase
    .from('books')
    .select('slug')
    .eq('slug', slug)
    .eq('settings->>published', 'true')
    .maybeSingle()

  if (data) return { status: 'found' }

  const to = await findCurrentSlug(slug)
  return to ? { status: 'moved', to } : { status: 'missing' }
}
