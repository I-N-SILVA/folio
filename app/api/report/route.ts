import { NextRequest, NextResponse } from 'next/server'
import { createHash } from 'node:crypto'
import { z } from 'zod'
import { supabaseAdmin, hasServiceRoleKey } from '@/lib/supabase'
import { rateLimit, clientIp } from '@/lib/rate-limit'
import { sendEmail } from '@/lib/email'
import { claimEmailSend } from '@/lib/email-quota'
import { REPORT_REASONS } from '@/lib/abuse'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://qlico.app'

/** Where reports go. A dedicated abuse inbox if there is one, support if not. */
const ABUSE_EMAIL =
  process.env.ABUSE_EMAIL || process.env.NEXT_PUBLIC_SUPPORT_EMAIL || 'support@qlico.app'

const ReportSchema = z.object({
  edition: z.string().min(1).max(100),
  reason: z.enum(REPORT_REASONS.map((r) => r.value) as [string, ...string[]]),
  details: z.string().max(2000).optional(),
  email: z.string().email().max(320).optional().or(z.literal('')),
})

/**
 * A reader reports an edition.
 *
 * Recorded in `edition_reports` (023) and mailed to the operator with the one
 * line of SQL that takes the edition down. Nothing is suspended automatically:
 * the number of reports is something a competitor can manufacture, and a
 * takedown is a decision a person should make.
 */
export async function POST(request: NextRequest) {
  const ip = clientIp(request)
  // Five an hour per address: enough for a real reader, useless for flooding.
  const limit = rateLimit(`report:${ip}`, 5, 60 * 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many reports from this connection. Try again later.' },
      { status: 429, headers: { 'Retry-After': String(limit.retryAfter) } }
    )
  }

  const parsed = ReportSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'Choose a reason for the report.' }, { status: 400 })
  }
  if (!hasServiceRoleKey()) {
    return NextResponse.json({ error: 'Reporting is not available right now.' }, { status: 503 })
  }

  const { edition, reason, details, email } = parsed.data
  const { data: book } = await supabaseAdmin
    .from('books')
    .select('id, slug, title, owner_id')
    .eq('slug', edition)
    .maybeSingle()

  if (!book) {
    return NextResponse.json({ error: 'That edition does not exist.' }, { status: 404 })
  }

  // A hash of the address rather than the address: enough to notice one
  // connection filing every report, without keeping readers' IPs.
  const reporterHash = createHash('sha256')
    .update(`${ip}:${process.env.CRON_SECRET ?? ''}`)
    .digest('hex')
    .slice(0, 32)

  const { error } = await supabaseAdmin.from('edition_reports').insert({
    book_id: book.id,
    reason,
    details: details?.trim() || null,
    reporter_email: email?.trim() || null,
    reporter_hash: reporterHash,
  })

  if (error) {
    // 42P01 = the table is missing (023 not applied). The email below is still
    // worth sending: a report that reaches a person matters more than the row.
    if (error.code !== '42P01') console.error('[report] could not record a report:', error)
  }

  // Counted against the day's email budget like a lead notification. Past it
  // the report is still recorded in edition_reports; only the email waits.
  if (await claimEmailSend('notice'))
    await sendEmail({
      to: ABUSE_EMAIL,
      subject: `[QLICO report] ${reason}: ${book.title}`,
      text: [
        `A reader reported an edition.`,
        ``,
        `Edition: ${book.title}`,
        `Link:    ${SITE_URL}/book/${book.slug}`,
        `Reason:  ${reason}`,
        `Owner:   ${book.owner_id}`,
        `Reporter email: ${email?.trim() || '(not given)'}`,
        ``,
        `Details:`,
        details?.trim() || '(none)',
        ``,
        `To take it down (Supabase SQL editor):`,
        `  SELECT public.suspend_edition('${book.slug}', '${reason}: <your note>');`,
        `To restore it:`,
        `  SELECT public.restore_edition('${book.slug}');`,
      ].join('\n'),
    })

  return new NextResponse(null, { status: 204 })
}
