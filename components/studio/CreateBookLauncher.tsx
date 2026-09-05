'use client'

import { Suspense, useEffect, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import dynamic from 'next/dynamic'
import { CreateBookModal } from './CreateBookModal'
import { takePendingImport } from '@/lib/pending-import'

// Same reason CreateBookModal loads it this way: the import dialog pulls in
// pdf.js, which touches DOMMatrix on import and cannot be prerendered.
const ImportPDFModal = dynamic(
  () => import('./ImportPDFModal').then((m) => m.ImportPDFModal),
  { ssr: false }
)

/**
 * One owner for the create dialog. `DashboardActions` renders in both the
 * page header and the empty state, so keeping the modal there would mount two
 * of them; and every entry point — the header button, the onboarding
 * checklist, the retired /create route — needs to open the same one. They all
 * navigate to `?new=1` and this picks it up.
 *
 * `?resume=1` is the landing page's hand-off: a visitor who dropped a PDF
 * before signing up stashed it (see lib/pending-import.ts), and this collects it
 * on the way back from the magic link so the import continues where they left
 * off rather than asking them to find the file again.
 */
function Launcher() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const resuming = searchParams.get('resume') === '1'

  const [pendingFile, setPendingFile] = useState<File | null>(null)
  const [resumeChecked, setResumeChecked] = useState(false)

  useEffect(() => {
    if (!resuming) return
    let active = true
    takePendingImport()
      .then((file) => {
        if (!active) return
        setPendingFile(file)
        setResumeChecked(true)
      })
      .catch(() => active && setResumeChecked(true))
    return () => {
      active = false
    }
  }, [resuming])

  const close = () => router.replace('/dashboard', { scroll: false })

  if (resuming) {
    // Wait for the lookup before deciding which dialog to open — rendering the
    // chooser first and swapping would flash a dialog the visitor didn't ask for.
    if (!resumeChecked) return null
    if (pendingFile) {
      return <ImportPDFModal initialFile={pendingFile} onClose={close} />
    }
    // The stash didn't survive (private window, cleared storage, a day passed).
    // Falling through to the normal chooser costs a re-upload, not a dead end.
    return <CreateBookModal onClose={close} />
  }

  // The URL *is* the state — no local mirror to keep in sync, and the browser
  // back button closes the dialog like people expect it to.
  if (searchParams.get('new') !== '1') return null

  // `?template=` comes from the gallery's "Start from this", so a visitor who
  // read an edition lands on that edition rather than on a chooser.
  return <CreateBookModal onClose={close} initialTemplateId={searchParams.get('template') ?? undefined} />
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
