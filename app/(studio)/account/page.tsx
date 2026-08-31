import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, Crown, Gift, Minus, CreditCard } from 'lucide-react'
import { createServerSupabase } from '@/lib/supabase-server'
import { getProfile, effectivePlan, countUserBooks } from '@/lib/entitlements'
import { formatQuota } from '@/lib/plans'
import { isBillingEnabled } from '@/lib/stripe'
import { UpgradeButton, ManageBillingButton } from '@/components/studio/BillingButtons'
import { DigestToggle } from '@/components/studio/DigestToggle'
import { StudioNav } from '@/components/studio/StudioNav'
import Reveal from '@/components/landing/Reveal'

export const dynamic = 'force-dynamic'

// Every row here is a thing the server actually checks. Rows for PDF import,
// custom domain and the watermark used to sit alongside these, and none of the
// three was enforced anywhere — one of them wasn't even built. A plan sheet that
// lists features the product gives away teaches the reader that plans are
// decorative.
const FEATURE_ROWS: { key: string; label: string }[] = [
  { key: 'maxBooks', label: 'Editions' },
  { key: 'analyticsDays', label: 'Analytics history' },
  { key: 'leadGating', label: 'Email capture on the reader' },
  { key: 'csvExport', label: 'CSV export' },
  { key: 'whiteLabel', label: 'Remove the QLICO badge' },
]

export default async function AccountPage({
  searchParams,
}: {
  searchParams?: Promise<{ upgraded?: string }>
}) {
  const resolvedParams = searchParams ? await searchParams : {}
  const upgraded = resolvedParams?.upgraded
  const supabase = await createServerSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  let profile
  try {
    profile = await getProfile(user.id, user.email)
  } catch {
    profile = { id: user.id, email: user.email ?? null, plan: 'free', status: 'active', appsumo_license_key: null, appsumo_tier: null }
  }

  const plan = effectivePlan(profile)
  let used = 0
  try {
    used = await countUserBooks(user.id)
  } catch {}
  const e = plan.entitlements

  const renderValue = (key: string) => {
    if (key === 'maxBooks') return formatQuota(e.maxBooks)
    if (key === 'analyticsDays') return `${e.analyticsDays} days`
    const on = (e as unknown as Record<string, unknown>)[key]
    return on ? <Check size={16} className="text-[var(--qlico-teal)]" /> : <Minus size={16} className="text-[var(--qlico-muted)]" />
  }

  const quotaPct = Number.isFinite(e.maxBooks) ? Math.min(100, Math.round((used / e.maxBooks) * 100)) : 0
  const billingOn = isBillingEnabled()
  const isProSubscriber = plan.id === 'pro'

  return (
    <main className="qlico-grain min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--qlico-ink)] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <StudioNav current="account" />

        {upgraded && (
          <div className="mb-6 flex items-center gap-3 rounded-[1.5rem] border border-green-200 bg-green-50 px-6 py-4">
            <Check size={18} className="text-green-700" />
            <p className="text-sm font-semibold text-green-800">
              You're upgraded — welcome to Pro. It can take a moment to reflect here.
            </p>
          </div>
        )}

        <Reveal as="section" className="mb-6 overflow-hidden rounded-[2.25rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/78 p-7 shadow-[var(--qlico-shadow)] backdrop-blur sm:p-9">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/60 px-3 py-1 text-xs font-semibold uppercase tracking-[0.22em] text-[var(--qlico-teal)]">
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
              <span>Editions used</span>
              <span className="text-[var(--qlico-muted)]">
                {used} / {formatQuota(e.maxBooks)}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-[var(--tint)]">
              <div
                className="h-full rounded-full bg-[var(--qlico-teal)] transition-all"
                style={{ width: `${Number.isFinite(e.maxBooks) ? quotaPct : 12}%` }}
              />
            </div>
          </div>
        </Reveal>

        <Reveal as="div" delay={80} className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-[2rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/72 p-7 shadow-sm">
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
            {/* The digest's unsubscribe line points here, so the switch has to
                actually be here. */}
            <div className="rounded-[2rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/72 p-7 shadow-sm">
              <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">Email</h2>
              <div className="mt-4">
                <DigestToggle
                  initial={Boolean((profile as { digest_opt_out?: boolean }).digest_opt_out)}
                />
              </div>
            </div>

            <div className="rounded-[2rem] border border-[var(--qlico-border)] bg-[var(--invert-surface)] p-7 text-[var(--invert-text)] shadow-sm">
              <Gift size={22} className="text-[var(--accent-contrast)]" />
              <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.04em]">Have an AppSumo code?</h2>
              <p className="mt-2 text-sm leading-6 text-[var(--invert-muted)]">
                Redeem your lifetime deal license to unlock your tier instantly.
              </p>
              <Link
                href="/redeem"
                className="mt-5 inline-block rounded-full bg-[var(--qlico-paper)] px-5 py-3 text-sm font-semibold uppercase tracking-[0.14em] text-[#1d1d1f] transition hover:-translate-y-0.5 hover:bg-[var(--qlico-subtle)]"
              >
                Redeem a code
              </Link>
            </div>

            {!plan.lifetime && plan.id === 'free' && (
              <div className="rounded-[2rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/72 p-7 shadow-sm">
                <Crown size={20} className="text-[var(--qlico-brass)]" />
                <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.04em]">Go Pro</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--qlico-muted)]">
                  Unlimited editions, email capture with lead export, and 12-month analytics —
                  $19/mo.
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
              <div className="rounded-[2rem] border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/72 p-7 shadow-sm">
                <CreditCard size={20} className="text-[var(--qlico-brass)]" />
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
