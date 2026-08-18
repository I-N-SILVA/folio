import 'server-only'

/**
 * Transactional email, optional at deploy time.
 *
 * A captured lead was the most valuable thing the product produced and the
 * hardest to find out about: it landed in the events table, and the author
 * discovered it only if they thought to open Insights and download a CSV. There
 * was no notification of any kind — the repo had no email provider at all — so
 * the one moment worth interrupting someone for never did.
 *
 * Configured like `lib/ai.ts`: without a key this reports itself unavailable and
 * every send is a no-op rather than an error, so a keyless install behaves
 * exactly as it did before instead of failing a reader's unlock.
 */

const API_URL = 'https://api.resend.com/emails'

export function isEmailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM)
}

export type SendResult = { sent: boolean; reason?: string }

export async function sendEmail(opts: {
  to: string
  subject: string
  /** Plain text. Kept text-only deliberately — see the note in sendLeadNotification. */
  text: string
  replyTo?: string
}): Promise<SendResult> {
  if (!isEmailEnabled()) return { sent: false, reason: 'not_configured' }

  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: process.env.EMAIL_FROM,
        to: opts.to,
        subject: opts.subject,
        text: opts.text,
        ...(opts.replyTo ? { reply_to: opts.replyTo } : {}),
      }),
    })

    if (!res.ok) {
      const detail = await res.text().catch(() => '')
      console.error('[email] send failed', res.status, detail.slice(0, 200))
      return { sent: false, reason: `http_${res.status}` }
    }
    return { sent: true }
  } catch (err) {
    console.error('[email] send threw', err)
    return { sent: false, reason: 'network' }
  }
}

/**
 * Tells an author that someone gave their email address to keep reading.
 *
 * Sent as plain text with the reader's address only in the body, never in a
 * header: the reader's address is untrusted input, and putting it in `from` or
 * `reply_to` unvalidated is how a notification becomes a relay. `reply_to` is
 * set to the reader's address only because replying to a lead is the obvious
 * next action, and the provider validates it before accepting the send.
 */
export async function sendLeadNotification(opts: {
  to: string
  editionTitle: string
  readerEmail: string
  editionUrl: string
  insightsUrl: string
}): Promise<SendResult> {
  return sendEmail({
    to: opts.to,
    replyTo: opts.readerEmail,
    subject: `New reader on "${opts.editionTitle}"`,
    text: [
      `${opts.readerEmail} gave their email to keep reading "${opts.editionTitle}".`,
      '',
      `Reply to this message to reach them directly.`,
      '',
      `The edition: ${opts.editionUrl}`,
      `Everyone who has read it: ${opts.insightsUrl}`,
    ].join('\n'),
  })
}

/**
 * The weekly digest: did anything happen, and is it worth a click.
 *
 * Written to be readable when the answer is "not much" — a digest that only
 * makes sense on a good week trains people to ignore it. The unsubscribe line is
 * in every send because a reporting email without one is spam, whatever the
 * headers say.
 */
export async function sendWeeklyDigest(opts: {
  to: string
  readers: number
  leads: number
  windowDays: number
  /** Best-performing edition of the week, when there is one. */
  top?: { title: string; readers: number } | null
  insightsUrl: string
  accountUrl: string
}): Promise<SendResult> {
  const { readers, leads, top } = opts
  const plural = (n: number, one: string, many = `${one}s`) => `${n} ${n === 1 ? one : many}`

  const headline =
    readers === 0
      ? 'No new readers this week.'
      : `${plural(readers, 'reader')} this week${leads > 0 ? `, and ${plural(leads, 'email')} captured` : ''}.`

  const body = [headline, '']

  if (top && top.readers > 0) {
    body.push(`Most read: "${top.title}" — ${plural(top.readers, 'reader')}.`, '')
  }

  if (readers === 0) {
    body.push(
      'Editions are read when they are sent. If one is sitting unshared, its link is on its',
      'page in Insights and works anywhere you can paste it.',
      ''
    )
  }

  body.push(
    `Which pages held attention, and for how long: ${opts.insightsUrl}`,
    '',
    `— QLICO`,
    `Not useful? Turn this off at ${opts.accountUrl}`
  )

  return sendEmail({
    to: opts.to,
    subject:
      readers === 0
        ? 'Your editions this week'
        : `${plural(readers, 'reader')} this week on QLICO`,
    text: body.join('\n'),
  })
}
