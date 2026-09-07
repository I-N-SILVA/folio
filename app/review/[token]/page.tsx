import type { Metadata } from 'next'
import { ReviewClient } from '@/components/review/ReviewClient'

/**
 * What a reviewer sees.
 *
 * Deliberately outside `(reader)`: this is a draft being looked at, not a
 * published edition. It does not apply the email gate, does not count towards
 * the author's reader analytics, and does not carry the badge — a client
 * pointing at page 4 is not a lead.
 */
export const metadata: Metadata = {
  title: 'Review draft',
  // A link with a credential in it must never end up in an index.
  robots: { index: false, follow: false, googleBot: { index: false, follow: false } },
}

export const dynamic = 'force-dynamic'

export default async function ReviewPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params
  return <ReviewClient token={token} />
}
