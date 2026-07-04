import type { Metadata } from 'next'
import { LegalShell, LegalSection } from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Terms of Service',
  description: 'The terms that govern your use of QLICO.',
}

export default function TermsPage() {
  return (
    <LegalShell title="Terms of Service" updated="June 12, 2026">
      <p className="text-[15px] leading-7 text-[var(--qlico-muted)]">
        These Terms of Service (&ldquo;Terms&rdquo;) govern your access to and use of QLICO (the
        &ldquo;Service&rdquo;). By using the Service you agree to these Terms. This is a template and
        should be reviewed by counsel before launch.
      </p>

      <LegalSection heading="Your account">
        <p>
          You are responsible for activity under your account and for keeping your sign-in method
          secure. You must be able to form a binding contract to use the Service.
        </p>
      </LegalSection>

      <LegalSection heading="Your content">
        <p>
          You retain ownership of the content you create. You grant us a limited license to host, store,
          and display that content solely to operate the Service. You are responsible for ensuring you
          have the rights to the content you upload and that it does not violate any law or third-party
          rights.
        </p>
      </LegalSection>

      <LegalSection heading="Acceptable use">
        <p>
          Do not use the Service to distribute unlawful, infringing, or malicious content, to abuse or
          overload the infrastructure, or to attempt to gain unauthorized access. We may suspend
          accounts that violate these Terms.
        </p>
      </LegalSection>

      <LegalSection heading="Plans, billing & lifetime deals">
        <p>
          Paid subscriptions renew until cancelled and are billed through Stripe; you can manage or
          cancel from the billing portal. Lifetime deals purchased through AppSumo are governed by
          AppSumo&apos;s refund policy; redeemed licenses unlock the corresponding plan and revert to the
          free tier if refunded. Plan limits (such as the number of books) are enforced by the Service.
        </p>
      </LegalSection>

      <LegalSection heading="Disclaimers & liability">
        <p>
          The Service is provided &ldquo;as is&rdquo; without warranties of any kind. To the maximum
          extent permitted by law, QLICO is not liable for indirect, incidental, or consequential
          damages, and our total liability is limited to the amount you paid in the prior twelve months.
        </p>
      </LegalSection>

      <LegalSection heading="Changes & termination">
        <p>
          We may update these Terms; material changes will be reflected by the &ldquo;last updated&rdquo;
          date. You may stop using the Service at any time, and we may suspend or terminate accounts that
          breach these Terms.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about these Terms? Email <strong>legal@qlico.app</strong>.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
