import type { Book } from './book-schema'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://qlico.app'

export interface WebhookLeadPayload {
  event: 'edition.lead_captured' | 'edition.test_event'
  timestamp: string
  edition: {
    id: string
    title: string
    slug: string
    url: string
  }
  lead: {
    email: string
    page_unlocked: number
    session_id?: string
  }
}

/**
 * Dispatches an asynchronous HTTP POST webhook to third-party endpoints (Zapier, Make, HubSpot, etc.)
 */
export async function dispatchLeadWebhook(
  book: Book,
  readerEmail: string,
  sessionId?: string
): Promise<{ ok: boolean; status?: number; error?: string }> {
  const webhookUrl = book.settings?.webhookUrl || book.settings?.gating?.webhookUrl
  if (!webhookUrl || !webhookUrl.startsWith('http')) {
    return { ok: false, error: 'No webhook configured' }
  }

  const payload: WebhookLeadPayload = {
    event: 'edition.lead_captured',
    timestamp: new Date().toISOString(),
    edition: {
      id: book.id,
      title: book.title,
      slug: book.slug,
      url: `${SITE_URL}/book/${book.slug}`,
    },
    lead: {
      email: readerEmail,
      page_unlocked: book.settings?.gating?.page_number ?? 3,
      session_id: sessionId,
    },
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'QLICO-Webhook/2.0',
        'X-Qlico-Event': 'edition.lead_captured',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeout)
    return { ok: res.ok, status: res.status }
  } catch (err: any) {
    console.error('[webhook] dispatch error:', err)
    return { ok: false, error: err?.message || 'Network timeout or error' }
  }
}

/**
 * Sends a sample test webhook payload to verify connection.
 */
export async function sendTestWebhook(
  targetUrl: string,
  bookTitle = 'Sample Lookbook Edition',
  slug = 'demo'
): Promise<{ ok: boolean; status?: number; error?: string }> {
  if (!targetUrl || !targetUrl.startsWith('http')) {
    return { ok: false, error: 'Invalid URL format' }
  }

  const payload: WebhookLeadPayload = {
    event: 'edition.test_event',
    timestamp: new Date().toISOString(),
    edition: {
      id: 'test-edition-id',
      title: bookTitle,
      slug,
      url: `${SITE_URL}/book/${slug}`,
    },
    lead: {
      email: 'reader-test@example.com',
      page_unlocked: 3,
      session_id: 'test-session-12345',
    },
  }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)

    const res = await fetch(targetUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'QLICO-Webhook/2.0',
        'X-Qlico-Event': 'edition.test_event',
      },
      body: JSON.stringify(payload),
      signal: controller.signal,
    })

    clearTimeout(timeout)
    return { ok: res.ok, status: res.status }
  } catch (err: any) {
    return { ok: false, error: err?.message || 'Connection failed or timed out' }
  }
}
