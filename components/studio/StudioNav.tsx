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
    <header className="mb-6 sm:mb-8 flex flex-wrap items-center justify-between gap-3 sm:gap-4 border-b border-[var(--qlico-border)] pb-4">
      <div className="flex items-center gap-3 sm:gap-6 min-w-0">
        <Link href="/dashboard" className="flex items-center gap-2 shrink-0" aria-label="QLICO dashboard">
          <Image
            src="/brand/icon.svg"
            alt=""
            width={28}
            height={28}
            className="h-7 w-7 rounded-md object-contain"
          />
          <span className="sr-only">QLICO</span>
        </Link>

        <nav aria-label="Studio" className="flex items-center gap-1 overflow-x-auto no-scrollbar py-0.5 scroll-smooth max-w-[calc(100vw-120px)] sm:max-w-none">
          <NavLink href="/dashboard" active={current === 'library'}>
            Editions
          </NavLink>
          <NavLink href="/insights" active={current === 'insights'}>
            Insights
          </NavLink>
          <NavLink href="/account" active={current === 'account'}>
            Account
          </NavLink>
          <NavLink href="/help">Help</NavLink>
        </nav>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <ThemeToggle className="flex" />
        <SignOutButton />
      </div>
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
      className={`rounded-full px-3 sm:px-3.5 py-1.5 sm:py-2 text-xs sm:text-sm font-semibold transition shrink-0 whitespace-nowrap ${
        active
          ? 'bg-[var(--accent)]/10 text-[var(--accent-fg)] font-bold'
          : 'text-[var(--qlico-muted)] hover:bg-[var(--tint-weak)] hover:text-[var(--qlico-ink)]'
      }`}
    >
      {children}
    </Link>
  )
}
