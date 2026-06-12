import type { Metadata } from 'next'
import { LegalShell, LegalSection } from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: 'How Folio collects, uses, and protects your data.',
}

export default function PrivacyPage() {
  return (
    <LegalShell title="Privacy Policy" updated="June 12, 2026">
      <p className="text-[15px] leading-7 text-[var(--folio-muted)]">
        This Privacy Policy explains how Folio (&ldquo;Folio,&rdquo; &ldquo;we,&rdquo; &ldquo;us&rdquo;)
        collects, uses, and shares information when you use our website, studio, and reader
        (collectively, the &ldquo;Service&rdquo;). This is a template and should be reviewed by counsel
        before launch.
      </p>

      <LegalSection heading="Information we collect">
        <p>
          <strong>Account data.</strong> When you sign in, we store your email address and an account
          identifier so we can authenticate you and associate the publications you create.
        </p>
        <p>
          <strong>Content.</strong> The books, pages, images, and settings you create are stored so we
          can host and display them.
        </p>
        <p>
          <strong>Reader analytics.</strong> When someone views a published folio, we record anonymous
          engagement events (opens, page views, dwell time, hotspot clicks). These are tied to a random
          session identifier, not to a named individual.
        </p>
        <p>
          <strong>Billing.</strong> Subscription payments are processed by Stripe and lifetime deals by
          AppSumo. We store a customer/license identifier and plan status; we never store full card
          numbers.
        </p>
      </LegalSection>

      <LegalSection heading="How we use information">
        <p>
          To operate and secure the Service, authenticate you, render and host your publications,
          provide analytics to publication owners, process payments, and communicate important updates.
        </p>
      </LegalSection>

      <LegalSection heading="Subprocessors">
        <p>
          We rely on trusted infrastructure providers, including Supabase (database, auth, storage),
          Vercel (hosting), Stripe (subscription billing), and AppSumo (lifetime-deal licensing). Each
          processes data only as needed to provide their service.
        </p>
      </LegalSection>

      <LegalSection heading="Data retention">
        <p>
          We retain account and content data while your account is active. Analytics history is retained
          according to your plan. You may request deletion of your account and associated data at any
          time.
        </p>
      </LegalSection>

      <LegalSection heading="Your rights">
        <p>
          Depending on your jurisdiction, you may have rights to access, correct, export, or delete your
          personal data. To exercise these rights, contact us using the details below.
        </p>
      </LegalSection>

      <LegalSection heading="Contact">
        <p>
          Questions about this policy? Email <strong>privacy@folio.new</strong>.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
