'use client'

import { Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CreateBookModal } from './CreateBookModal'

/**
 * One owner for the create dialog. `DashboardActions` renders in both the
 * page header and the empty state, so keeping the modal there would mount two
 * of them; and every entry point — the header button, the onboarding
 * checklist, the retired /create route — needs to open the same one. They all
 * navigate to `?new=1` and this picks it up.
 */
function Launcher() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // The URL *is* the state — no local mirror to keep in sync, and the browser
  // back button closes the dialog like people expect it to.
  if (searchParams.get('new') !== '1') return null

  return <CreateBookModal onClose={() => router.replace('/dashboard', { scroll: false })} />
}

export function CreateBookLauncher() {
  // useSearchParams needs a suspense boundary to avoid opting the whole route
  // into client-side rendering.
  return (
    <Suspense fallback={null}>
      <Launcher />
    </Suspense>
  )
}
