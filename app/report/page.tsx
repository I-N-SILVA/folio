import type { Metadata } from 'next'
import { LegalShell } from '@/components/legal/LegalShell'
import { ReportForm } from '@/components/legal/ReportForm'

export const metadata: Metadata = {
  title: 'Report an edition — QLICO',
  description: 'Tell us about an edition that is phishing, a scam, malware or otherwise abusive.',
  robots: { index: false, follow: false },
}

/**
 * Where the reader's "Report" link lands. A server component so the edition
 * comes from the address without `useSearchParams` and the Suspense boundary
 * it would need.
 */
export default async function ReportPage({
  searchParams,
}: {
  searchParams: Promise<{ edition?: string }>
}) {
  const { edition } = await searchParams
  const slug = typeof edition === 'string' && /^[a-z0-9-]{1,100}$/.test(edition) ? edition : ''

  return (
    <LegalShell title="Report an edition" updated="October 2026">
      <p className="text-[15px] leading-7 text-[var(--qlico-muted)]">
        Editions on QLICO are published by their authors. If one is trying to collect passwords or
        card details, sends people to malware, or breaks the law, tell us here. A person reads every
        report, and an edition can be taken down within minutes.
      </p>
      <ReportForm initialEdition={slug} />
    </LegalShell>
  )
}
