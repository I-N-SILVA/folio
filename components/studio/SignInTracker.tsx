'use client'

import { useEffect } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import { trackProduct } from '@/lib/product-analytics'

/**
 * Fires `signup_completed` on the hop back from a magic link, then removes the
 * marker from the URL so a refresh or a shared link doesn't count again.
 *
 * The auth callback is a server route and can't emit a client event, so the one
 * step nothing could see — how many people who asked for a link actually
 * returned from their inbox — needed a marker carried across the redirect. That
 * gap is the largest suspected drop in the funnel and, until now, the only one
 * with no instrument on it at all.
 */
export function SignInTracker() {
  const params = useSearchParams()
  const router = useRouter()
  const pathname = usePathname()

  useEffect(() => {
    if (params.get('signed_in') !== '1') return

    trackProduct('signup_completed')

    const next = new URLSearchParams(params.toString())
    next.delete('signed_in')
    const query = next.toString()
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false })
  }, [params, pathname, router])

  return null
}
