import { notFound, permanentRedirect } from 'next/navigation'
import { resolveReaderSlug } from '@/lib/reader-slug'

/**
 * The segment's status code, decided before a byte is sent.
 *
 * `loading.tsx` in this folder wraps `page.tsx` in a Suspense boundary, and the
 * response body starts streaming the moment that fallback renders. Next's
 * `loading.js` reference is explicit about the consequence: "Because the
 * response headers have already been sent to the client, the status code of the
 * response cannot be updated" — `permanentRedirect` degrades to a `<meta
 * http-equiv="refresh">` in the body and `notFound` to a `noindex` 200.
 *
 * A browser follows the meta tag, so this looked fine to a human clicking a
 * renamed edition's old link. Nothing else follows it. Every link already
 * shared — the unfurl in Slack, the card on LinkedIn, a link checker, a crawler
 * revisiting the old address — got HTTP 200 and a page whose visible text reads
 * "Not Found". The one thing `book_slug_history` exists to protect was the one
 * thing that stayed broken, and the reader skeleton is what broke it.
 *
 * A layout is not wrapped by `loading.js` in its own segment, so this runs
 * ahead of the boundary, which is where the docs say the existence check
 * belongs: "ensure the resource exists before the response body is streamed".
 * The cost is one indexed single-column lookup before the shell flushes; the
 * edition itself still streams in behind the skeleton.
 */
export default async function BookSlugLayout({
  children,
  params,
}: {
  children: React.ReactNode
  params: Promise<{ slug: string }>
}) {
  const { slug } = await params
  const resolved = await resolveReaderSlug(slug)

  // Both of these throw, so they stay out of any try/catch and out of the
  // Suspense boundary below.
  if (resolved.status === 'moved') permanentRedirect(`/book/${resolved.to}`)
  if (resolved.status === 'missing') notFound()

  return children
}
