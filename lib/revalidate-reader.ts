import 'server-only'
import { revalidatePath } from 'next/cache'

/**
 * Drop the cached public copies of an edition after the author changes it.
 *
 * The reader page is ISR (`export const revalidate = 60`), which is right for
 * a page strangers hit from a link and wrong for the sixty seconds after the
 * author presses save. Nothing in this codebase called `revalidatePath`, so
 * every edit — a fixed typo, a newly published edition, a rename — was
 * invisible at its own public address until the window expired.
 *
 * The rename case is the one that actually costs something: the *old* address
 * keeps serving its cached 200 rather than the 308 to the new one, so for a
 * minute the link an author has just corrected still shows the old edition.
 *
 * Both addresses are cleared on a rename, hence `slugs`. In a Route Handler
 * this marks the paths; the rebuild happens on the next visit.
 */
export function revalidateReader(...slugs: (string | null | undefined)[]) {
  for (const slug of new Set(slugs.filter(Boolean) as string[])) {
    revalidatePath(`/book/${slug}`)
    revalidatePath(`/embed/${slug}`)
  }
}
