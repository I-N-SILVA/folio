import Link from 'next/link'
import { WifiOff } from 'lucide-react'

export const metadata = { title: 'Offline' }

export default function OfflinePage() {
  return (
    <main className="folio-grain flex min-h-screen items-center justify-center bg-[var(--background)] p-6 text-[var(--folio-ink)]">
      <div className="max-w-md rounded-[2.25rem] border border-[var(--folio-border)] bg-[#ffffff]/85 p-10 text-center shadow-[var(--folio-shadow)] backdrop-blur">
        <div className="mx-auto mb-5 grid h-14 w-14 place-items-center rounded-2xl bg-[var(--folio-ink)] text-[#ffffff]">
          <WifiOff size={26} />
        </div>
        <h1 className="font-display text-3xl font-semibold tracking-[-0.04em]">You're offline</h1>
        <p className="mt-3 text-sm leading-6 text-[var(--folio-muted)]">
          Riffle needs a connection to load this page. Reconnect and try again — your work is saved.
        </p>
        <Link
          href="/dashboard"
          className="mt-7 inline-block rounded-full bg-[var(--folio-teal)] px-6 py-3 text-sm font-extrabold uppercase tracking-[0.14em] text-white transition hover:-translate-y-0.5 hover:bg-[#0a5be0]"
        >
          Retry
        </Link>
      </div>
    </main>
  )
}
