import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { sendWeeklyDigest } from '@/lib/email'

/**
 * The exact words the weekly digest sends.
 *
 * `HANDOVER` has said for two branches that this is "written, scheduled,
 * idempotent and typechecked, and no human has ever received one". It is the
 * retention half of the product's only compounding loop, and the first time
 * anyone reads it should not be the first time it lands in a customer's inbox.
 *
 * So the body is captured here for every case it has to handle, and asserted on
 * the things that would embarrass: the zero-week (which is most weeks for a new
 * author, and a digest that only makes sense on a good week trains people to
 * ignore it), singular vs plural, and the unsubscribe line, which a reporting
 * email without is spam whatever the headers say.
 *
 * Run `npx vitest run lib/email-digest.test.ts --reporter=verbose` and the
 * console output is the email.
 */

const ORIGINAL_FETCH = globalThis.fetch

/** Captures the payload Resend would have received. */
function captureSend() {
  const sent: { subject: string; text: string; to: string }[] = []
  globalThis.fetch = vi.fn(async (_url: string, init: RequestInit) => {
    const body = JSON.parse(String(init.body))
    sent.push({ subject: body.subject, text: body.text, to: body.to })
    return new Response('{}', { status: 200 })
  }) as unknown as typeof fetch
  return sent
}

const BASE = {
  to: 'author@example.com',
  windowDays: 7,
  insightsUrl: 'https://qlico.app/insights',
  accountUrl: 'https://qlico.app/account',
}

beforeEach(() => {
  vi.stubEnv('RESEND_API_KEY', 're_test')
  vi.stubEnv('EMAIL_FROM', 'QLICO <hello@qlico.app>')
})

afterEach(() => {
  globalThis.fetch = ORIGINAL_FETCH
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

describe('the weekly digest, as it will arrive', () => {
  it('reads sensibly on a week where nothing happened', async () => {
    const sent = captureSend()
    await sendWeeklyDigest({ ...BASE, readers: 0, leads: 0, top: null })

    const [email] = sent
    expect(email.subject).toBe('Your editions this week')
    expect(email.text).toContain('No new readers this week.')
    // Says something useful rather than just reporting a zero.
    expect(email.text).toContain('Editions are read when they are sent')
    expect(email.text).toContain('https://qlico.app/insights')
    expect(email.text).toContain('Turn this off at https://qlico.app/account')

    console.log('\n──── zero week ────\nSubject: ' + email.subject + '\n\n' + email.text + '\n')
  })

  it('reads sensibly on a good week', async () => {
    const sent = captureSend()
    await sendWeeklyDigest({
      ...BASE,
      readers: 42,
      leads: 7,
      top: { title: 'Spring/Summer Lookbook', readers: 31 },
    })

    const [email] = sent
    expect(email.subject).toBe('42 readers on QLICO')
    expect(email.text).toContain('42 readers this week, and 7 emails captured.')
    expect(email.text).toContain('Most read: "Spring/Summer Lookbook" — 31 readers.')

    console.log('\n──── good week ────\nSubject: ' + email.subject + '\n\n' + email.text + '\n')
  })

  it('gets singulars right, because "1 readers" is the tell that nobody read it', async () => {
    const sent = captureSend()
    await sendWeeklyDigest({
      ...BASE,
      readers: 1,
      leads: 1,
      top: { title: 'One Pager', readers: 1 },
    })

    const [email] = sent
    expect(email.subject).toBe('1 reader on QLICO')
    expect(email.text).toContain('1 reader this week, and 1 email captured.')
    expect(email.text).toContain('— 1 reader.')
    expect(email.text).not.toMatch(/\b1 (readers|emails)\b/)
  })

  it('omits the capture clause when there were no leads', async () => {
    const sent = captureSend()
    await sendWeeklyDigest({ ...BASE, readers: 9, leads: 0, top: null })
    expect(sent[0].text).toContain('9 readers this week.')
    expect(sent[0].text).not.toContain('captured')
  })

  it('does not name a top edition nobody read', async () => {
    const sent = captureSend()
    await sendWeeklyDigest({ ...BASE, readers: 3, leads: 0, top: { title: 'Ghost', readers: 0 } })
    expect(sent[0].text).not.toContain('Ghost')
  })

  it('says "in the last N days" when the window is not a week', async () => {
    const sent = captureSend()
    await sendWeeklyDigest({ ...BASE, windowDays: 10, readers: 2, leads: 0, top: null })
    expect(sent[0].text).toContain('in the last 10 days')
  })

  it('always carries a way out', async () => {
    // A reporting email without an unsubscribe is spam whatever the headers
    // say, and the one case most likely to lose it is the zero-week branch.
    for (const readers of [0, 1, 500]) {
      const sent = captureSend()
      await sendWeeklyDigest({ ...BASE, readers, leads: 0, top: null })
      expect(sent[0].text, `readers=${readers}`).toContain('Turn this off at')
    }
  })

  it('sends nothing at all when email is not configured', async () => {
    vi.unstubAllEnvs()
    const sent = captureSend()
    const result = await sendWeeklyDigest({ ...BASE, readers: 5, leads: 0, top: null })
    expect(result).toEqual({ sent: false, reason: 'not_configured' })
    expect(sent).toEqual([])
  })

  it('reports a provider failure instead of claiming it sent', async () => {
    // The cron marks `digest_last_sent_at` on the strength of this answer, so a
    // false "sent" costs the author a week.
    globalThis.fetch = vi.fn(async () => new Response('bad key', { status: 401 })) as unknown as typeof fetch
    const result = await sendWeeklyDigest({ ...BASE, readers: 5, leads: 0, top: null })
    expect(result.sent).toBe(false)
    expect(result.reason).toBe('http_401')
  })
})
