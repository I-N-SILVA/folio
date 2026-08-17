import Link from 'next/link'
import Image from 'next/image'
import { SignOutButton } from './SignOutButton'
import { ThemeToggle } from '@/components/ThemeToggle'

/**
 * The studio group had no shared chrome: the dashboard bolted its navigation
 * into DashboardActions and /account made do with a lone "← Back to studio"
 * link, so which surface you were on and how to leave it changed page to page.
 */
export function StudioNav({ current }: { current?: 'library' | 'insights' | 'account' }) {
  return (
    <header className="mb-8 flex items-center gap-4 border-b border-[var(--qlico-border)] pb-4">
      <Link href="/dashboard" className="flex items-center gap-2" aria-label="QLICO dashboard">
        <Image
          src="/brand/icon-192.png"
          alt=""
          width={28}
          height={28}
          className="h-7 w-7 rounded-md"
        />
        <span className="sr-only">QLICO</span>
      </Link>

      <nav aria-label="Studio" className="flex items-center gap-1">
        <NavLink href="/dashboard" active={current === 'library'}>
          Editions
        </NavLink>
        {/* Reader numbers used to live behind an unlabelled icon on a single
            book card. They're the only thing in the product that changes while
            the author is away, so they're the reason to come back — which makes
            a nav slot the right price for them. */}
        <NavLink href="/insights" active={current === 'insights'}>
          Insights
        </NavLink>
        <NavLink href="/account" active={current === 'account'}>
          Account
        </NavLink>
      </nav>

      <div className="flex-1" />
      <ThemeToggle className="hidden sm:flex" />
      <SignOutButton />
    </header>
  )
}

function NavLink({
  href,
  active,
  children,
}: {
  href: string
  active?: boolean
  children: React.ReactNode
}) {
  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={`rounded-full px-3.5 py-2 text-sm font-semibold transition ${
        active
          ? 'bg-[var(--accent)]/10 text-[var(--accent-fg)]'
          : 'text-[var(--qlico-muted)] hover:bg-[var(--tint-weak)] hover:text-[var(--qlico-ink)]'
      }`}
    >
      {children}
    </Link>
  )
}
