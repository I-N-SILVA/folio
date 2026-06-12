import Link from 'next/link'
import { redirect } from 'next/navigation'
import { Check, Crown, Gift, Minus, Sparkles } from 'lucide-react'
import { createServerSupabase } from '@/lib/supabase-server'
import { getProfile, effectivePlan, countUserBooks } from '@/lib/entitlements'
import { formatQuota } from '@/lib/plans'
import { isBillingEnabled } from '@/lib/stripe'
import { UpgradeButton, ManageBillingButton } from '@/components/studio/BillingButtons'

export const dynamic = 'force-dynamic'

const FEATURE_ROWS: { key: string; label: string }[] = [
  { key: 'maxBooks', label: 'Books' },
  { key: 'analyticsDays', label: 'Analytics history' },
  { key: 'pdfImport', label: 'PDF import' },
  { key: 'leadGating', label: 'Lead gating' },
  { key: 'customDomain', label: 'Custom domain' },
  { key: 'csvExport', label: 'CSV export' },
  { key: 'whiteLabel', label: 'White-label (no Folio branding)' },
  { key: 'watermark', label: 'Reader watermark' },
]

export default async function AccountPage() {
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
      return e.watermark ? <Minus size={16} className="text-[var(--folio-muted)]" /> : <Check size={16} className="text-[var(--folio-teal)]" />
    }
    const on = (e as Record<string, unknown>)[key]
    return on ? <Check size={16} className="text-[var(--folio-teal)]" /> : <Minus size={16} className="text-[var(--folio-muted)]" />
  }

  const quotaPct = Number.isFinite(e.maxBooks) ? Math.min(100, Math.round((used / e.maxBooks) * 100)) : 0
  const billingOn = isBillingEnabled()
  const isProSubscriber = plan.id === 'pro'

  return (
    <main className="folio-grain min-h-screen bg-[var(--background)] px-5 py-8 text-[var(--folio-ink)] sm:px-8">
      <div className="mx-auto max-w-4xl">
        <div className="mb-6 flex items-center justify-between">
          <Link href="/dashboard" className="text-sm font-bold text-[var(--folio-muted)] hover:text-[var(--folio-ink)]">
            ← Back to studio
          </Link>
        </div>

        <section className="mb-6 overflow-hidden rounded-[2.25rem] border border-[var(--folio-border)] bg-[#fff8ec]/78 p-7 shadow-[var(--folio-shadow)] backdrop-blur sm:p-9">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-[var(--folio-border)] bg-white/60 px-3 py-1 text-xs font-extrabold uppercase tracking-[0.22em] text-[var(--folio-teal)]">
            <Crown size={13} />
            {plan.lifetime ? 'Lifetime plan' : 'Current plan'}
          </div>
          <h1 className="font-display text-5xl font-semibold leading-none tracking-[-0.06em]">{plan.name}</h1>
          <p className="mt-3 max-w-xl text-sm leading-6 text-[var(--folio-muted)]">{plan.tagline}</p>

          {profile.status !== 'active' && (
            <p className="mt-4 inline-block rounded-full bg-[#fbe4e1] px-4 py-1.5 text-xs font-bold text-[#8a2b26]">
              Account status: {profile.status} — entitlements reverted to Free.
            </p>
          )}

          <div className="mt-7 max-w-md">
            <div className="flex items-center justify-between text-sm font-bold">
              <span>Books used</span>
              <span className="text-[var(--folio-muted)]">
                {used} / {formatQuota(e.maxBooks)}
              </span>
            </div>
            <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-black/8">
              <div
                className="h-full rounded-full bg-[var(--folio-teal)] transition-all"
                style={{ width: `${Number.isFinite(e.maxBooks) ? quotaPct : 12}%` }}
              />
            </div>
          </div>
        </section>

        <div className="grid gap-6 lg:grid-cols-[1.4fr_1fr]">
          <section className="rounded-[2rem] border border-[var(--folio-border)] bg-[#fffaf0]/72 p-7 shadow-sm">
            <h2 className="font-display text-2xl font-semibold tracking-[-0.04em]">What's included</h2>
            <dl className="mt-5 divide-y divide-[var(--folio-border)]">
              {FEATURE_ROWS.map(({ key, label }) => (
                <div key={key} className="flex items-center justify-between py-3">
                  <dt className="text-sm font-semibold text-[var(--folio-ink)]">{label}</dt>
                  <dd className="text-sm font-bold">{renderValue(key)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <aside className="flex flex-col gap-5">
            <div className="rounded-[2rem] border border-[var(--folio-border)] bg-[var(--folio-ink)] p-7 text-[#fbf1df] shadow-sm">
              <Gift size={22} className="text-[#d6aa66]" />
              <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.04em]">Have an AppSumo code?</h2>
              <p className="mt-2 text-sm leading-6 text-[#d8c6aa]">
                Redeem your lifetime deal license to unlock your tier instantly.
              </p>
              <Link
                href="/redeem"
                className="mt-5 inline-block rounded-full bg-[#d6aa66] px-5 py-3 text-sm font-extrabold uppercase tracking-[0.14em] text-[#271c10] transition hover:-translate-y-0.5 hover:bg-[#e3bd83]"
              >
                Redeem a code
              </Link>
            </div>

            {!plan.lifetime && plan.id === 'free' && (
              <div className="rounded-[2rem] border border-[var(--folio-border)] bg-[#fffaf0]/72 p-7 shadow-sm">
                <Sparkles size={20} className="text-[var(--folio-brass)]" />
                <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.04em]">Go Pro</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--folio-muted)]">
                  Unlimited books, custom domains, and 90-day analytics — $19/mo.
                </p>
                {billingOn ? (
                  <UpgradeButton className="mt-5" />
                ) : (
                  <Link
                    href="/#pricing"
                    className="mt-5 inline-block rounded-full bg-[var(--folio-teal)] px-5 py-3 text-sm font-extrabold uppercase tracking-[0.14em] text-white transition hover:-translate-y-0.5 hover:bg-[#09514d]"
                  >
                    See plans
                  </Link>
                )}
              </div>
            )}

            {billingOn && isProSubscriber && (
              <div className="rounded-[2rem] border border-[var(--folio-border)] bg-[#fffaf0]/72 p-7 shadow-sm">
                <Sparkles size={20} className="text-[var(--folio-brass)]" />
                <h2 className="mt-4 font-display text-2xl font-semibold tracking-[-0.04em]">Billing</h2>
                <p className="mt-2 text-sm leading-6 text-[var(--folio-muted)]">
                  Update your card, view invoices, or cancel anytime.
                </p>
                <ManageBillingButton className="mt-5" />
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  )
}
