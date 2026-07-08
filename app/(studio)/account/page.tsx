import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, Crown, Gift, Minus, Sparkles } from 'lucide-react'
import { createServerSupabase } from '@/lib/supabase-server'
import { getProfile, effectivePlan, countUserBooks } from '@/lib/entitlements'
import { formatQuota } from '@/lib/plans'
import { isBillingEnabled } from '@/lib/stripe'
import { UpgradeButton, ManageBillingButton } from '@/components/studio/BillingButtons'
import { SignOutButton } from '@/components/studio/SignOutButton'
import Reveal from '@/components/landing/Reveal'

export const dynamic = 'force-dynamic'

const FEATURE_ROWS: { key: string; label: string }[] = [
  { key: 'maxBooks', label: 'Books' },
  { key: 'analyticsDays', label: 'Analytics history' },
  { key: 'pdfImport', label: 'PDF import' },
  { key: 'leadGating', label: 'Lead gating' },
  { key: 'customDomain', label: 'Custom domain' },
  { key: 'csvExport', label: 'CSV export' },
  { key: 'whiteLabel', label: 'White-label (no QLICO branding)' },
  { key: 'watermark', label: 'Reader watermark' },
]

export default async function AccountPage({
  searchParams,
}: {
  searchParams: Promise<{ upgraded?: string }>
}) {
  const { upgraded } = await searchParams
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const profile = await getProfile(user.id, user.email)
  const plan = effectivePlan(profile)
  const used = await countUserBooks(user.id)
  const e = plan.entitlements

  const renderValue = (key: string) => {
    if (key === 'maxBooks') return formatQuota(e.maxBooks)
    if (key === 'analyticsDays') return `${e.analyticsDays} days`
    if (key === 'watermark') {
      return e.watermark ? <Minus size={16} className="text-[var(--qlico-muted)]" /> : <Check size={16} className="text-[var(--qlico-teal)]" />
    }
    const on = (e as Record<string, unknown>)[key]
    return on ? <Check size={16} className="text-[var(--qlico-teal)]" /> : <Minus size={16} className="text-[var(--qlico-muted)]" />
  }

  const quotaPct = Number.isFinite(e.maxBooks) ? Math.min(100, Math.round((used / e.maxBooks) * 100)) : 0
  const billingOn = isBillingEnabled()
  const isProSubscriber = plan.id === 'pro'

  return (
    <main className="qlico-grain min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--qlico-ink)] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm font-bold text-[var(--qlico-muted)] hover:text-[var(--qlico-ink)]">
            ← Back to studio
          </Link>
          <SignOutButton />
        </div>

        {upgraded && (
          <div className="mb-6 flex items-center gap-3 rounded-[1.5rem] border border-green-200 bg-green-50 px-6 py-4">
            <Check size={18} className="text-green-700" />
            <p className="text-sm font-semibold text-green-800">
              You're upgraded — welcome to Pro. It can take a moment to reflect here.
            </p>
          </div>
        )}

        <Reveal as="section" className="mb-6 overflow-hidden rounded-[2.25rem] border border-[var(--qlico-border)] bg-[#ffffff]/78 p-7 shadow-[var(--qlico-shadow)] backdrop-blur sm:p-9">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--qlico-border)] bg-white/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--qlico-teal)]">
            <Crown size={13} />
            {plan.lifetime ? 'Lifetime plan' : 'Current plan'}
          </div>
          <h1 className="font-display text-5xl font-semibold leading-none tracking-[-0.06em]">{plan.name}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--qlico-muted)]">{plan.tagline}</p>

          {profile.status !== 'active' && (
            <p className="mt-4 inline-block rounded-full bg-[#fbe4e1] px-4 py-1.5 text-xs font-bold text-[#8a2b26]">
              Account status: {profile.status} — entitlements reverted to Free.
            </p>
          )}

          <div className="mt-7 max-w-md">
            <div className="flex items-center justify-between text-sm font-bold">
              <span>Books used</span>
              <span className="text-[var(--qlico-muted)]">
                {used} / {formatQuota(e.maxBooks)}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/8">
              <div
                className="h-full rounded-full bg-[var(--qlico-teal)] transition-all"
                style={{ width: `${Number.isFinite(e.maxBooks) ? quotaPct : 12}%` }}
              />
            </div>
          </div>
        </Reveal>

        <Reveal as="div" delay={80} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-[2rem] border border-[var(--qlico-border)] bg-[#ffffff]/72 p-7 shadow-sm">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">What's included</h2>
            <dl className="mt-5 divide-y divide-[var(--qlico-border)]">
              {FEATURE_ROWS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-3">
                  <dt className="text-sm font-semibold text-[var(--qlico-ink)]">{label}</dt>
                  <dd className="text-sm font-bold">{renderValue(key)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <aside className="flex flex-col gap-5">
            <div className="rounded-[2rem] border border-[var(--qlico-border)] bg-[var(--qlico-ink)] p-7 text-[#ffffff] shadow-sm">
              <Gift size={22} className="text-[#ffffff]" />
              <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.04em]">Have an AppSumo code?</h2>
              <p className="mt-2 text-sm leading-6 text-[#a1a1a6]">
                Redeem your lifetime deal license to unlock your tier instantly.
              </p>
              <Link
                href="/redeem"
                className="mt-5 inline-block rounded-full bg-[#ffffff] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#1d1d1f] transition hover:-translate-y-0.5 hover:bg-[#f5f5f7]"
              >
                Redeem a code
              </Link>
            </div>

            {!plan.lifetime && plan.id === 'free' && (
              <div className="rounded-[2rem] border border-[var(--qlico-border)] bg-[#ffffff]/72 p-7 shadow-sm">
                <Sparkles size={20} className="text-[var(--qlico-brass)]" />
                <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.04em]">Go Pro</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--qlico-muted)]">
                  Unlimited books, custom domains, and 90-day analytics — $19/mo.
                </p>
                {billingOn ? (
                  <UpgradeButton className="mt-5" />
                ) : (
                  <Link
                    href="/#pricing"
                    className="mt-5 inline-block rounded-full bg-[var(--qlico-teal)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-white transition hover:-translate-y-0.5 hover:bg-[var(--accent-hover)]"
                  >
                    See plans
                  </Link>
                )}
              </div>
            )}

            {billingOn && isProSubscriber && (
              <div className="rounded-[2rem] border border-[var(--qlico-border)] bg-[#ffffff]/72 p-7 shadow-sm">
                <Sparkles size={20} className="text-[var(--qlico-brass)]" />
                <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.04em]">Billing</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--qlico-muted)]">
                  Update your card, view invoices, or cancel anytime.
                </p>
                <ManageBillingButton className="mt-5" />
              </div>
            )}
          </aside>
        </Reveal>
      </div>
    </main>
  )
}
