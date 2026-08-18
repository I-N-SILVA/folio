import Link from 'next/link'
import type { Metadata } from 'next'
import { LegalShell, LegalSection } from '@/components/legal/LegalShell'

export const metadata: Metadata = {
  title: 'Help & support — QLICO',
  description:
    'How to import a PDF, publish an edition, embed it, capture emails, and read your analytics. Plus how to reach a human.',
}

/**
 * There was no help, docs or support link anywhere in the app.
 *
 * That is a product gap on its own and a specific commercial one for the
 * lifetime-deal launch this repo is being prepared for: marketplace ratings turn
 * on how fast buyers get answered, and the first thing a stuck buyer looks for is
 * a support link. Deliberately one page of plain answers rather than a docs site —
 * it can be written now, and it covers the questions the product's own flows
 * raise.
 */

const SUPPORT_EMAIL = process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@qlico.app'

function Mail() {
  return (
    <a
      href={`mailto:${SUPPORT_EMAIL}`}
      className="font-semibold text-[var(--accent-fg)] hover:underline"
    >
      {SUPPORT_EMAIL}
    </a>
  )
}

function A({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="font-semibold text-[var(--accent-fg)] hover:underline">
      {children}
    </Link>
  )
}

export default function HelpPage() {
  return (
    <LegalShell title="Help & support" updated="August 2026">
      <p className="text-[15px] leading-7 text-[var(--qlico-muted)]">
        Short answers to the things people actually get stuck on. If yours isn&apos;t here, write to{' '}
        <Mail /> — a person reads it.
      </p>

      <LegalSection heading="How do I turn a PDF into an edition?">
        <p>
          From your editions, choose <strong>Create</strong>, then <strong>Import a PDF</strong>.
          Each page is rendered in your browser and uploaded as a spread — up to 50 pages, 50 MB.
          You can also drop a PDF onto the <A href="/#try">home page</A> to see it as an edition
          before signing in at all.
        </p>
      </LegalSection>

      <LegalSection heading="I published. Where is my link?">
        <p>
          Publishing saves the edition and opens the share dialog with its link and embed code. The
          link is <code>/book/your-edition</code> and works for anyone — no account, no app. If you
          closed the dialog, the <strong>Share</strong> button in the editor toolbar has the same
          thing.
        </p>
      </LegalSection>

      <LegalSection heading="Can I change an edition's link?">
        <p>
          Not yet. The link is set when the edition is created and then stays fixed, so anything you
          have already sent keeps working. You can rename an edition freely — the title and the link
          are separate.
        </p>
      </LegalSection>

      <LegalSection heading="How do I embed an edition in my own site?">
        <p>
          The share dialog gives you an <code>&lt;iframe&gt;</code> snippet. Paste it into any page,
          store or CMS that accepts HTML. It is responsive, and it counts reads exactly as the
          hosted link does.
        </p>
      </LegalSection>

      <LegalSection heading="How does email capture work?">
        <p>
          In the editor&apos;s <strong>Edition</strong> settings, switch on{' '}
          <em>Ask for an email to keep reading</em> and choose the page it starts at. Readers get
          the pages before it, then a form. Pages past the gate are never sent to the browser until
          an address is given, so the gate cannot be clicked away in devtools. Captured addresses
          appear in Insights and export as CSV. This is a paid-plan feature.
        </p>
      </LegalSection>

      <LegalSection heading="What do the numbers mean?">
        <p>
          A <strong>reader</strong> is one browsing session, not one page open — someone who opens
          an edition three times is one reader, not three. <strong>Finished</strong> is the share of
          readers who reached the last page. Per-edition Insights also show time spent per page, a
          click heatmap, and which hotspots were tapped.
        </p>
      </LegalSection>

      <LegalSection heading="Why can I only see the last 30 days?">
        <p>
          Analytics history is part of your plan — 30 days on Free, 12 months on paid. The range you
          pick is capped to what your plan keeps, and the page says so when it caps you. See{' '}
          <A href="/account">your account</A>.
        </p>
      </LegalSection>

      <LegalSection heading="How do I remove the QLICO badge?">
        <p>
          Paid plans can switch it off per edition, in the editor&apos;s <strong>Edition</strong>{' '}
          settings under Access. On the free plan the badge stays — it is how most people find us.
        </p>
      </LegalSection>

      <LegalSection heading="I have a lifetime deal code">
        <p>
          Redeem it at <A href="/redeem">/redeem</A> while signed in. Stacked codes move you up a
          tier and your entitlements update immediately. If a code is rejected, send us the code and
          the email address you bought with.
        </p>
      </LegalSection>

      <LegalSection heading="Can I get my data out?">
        <p>
          Yes. On any paid plan, Insights exports every recorded event and every captured email as
          CSV, as far back as your plan keeps. No export fee, no notice period.
        </p>
      </LegalSection>

      <LegalSection heading="Still stuck?">
        <p>
          Email <Mail /> with the edition&apos;s link and what you expected to happen. That pair
          answers most questions in one reply instead of three.
        </p>
      </LegalSection>
    </LegalShell>
  )
}
