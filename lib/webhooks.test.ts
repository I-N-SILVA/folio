import { describe, it, expect } from 'vitest'
import { dispatchLeadWebhook, sendTestWebhook } from './webhooks'
import type { Book } from './book-schema'

describe('Webhooks', () => {
  it('returns false when no webhook URL is configured', async () => {
    const book: Book = {
      id: 'b1',
      slug: 'my-book',
      title: 'My Book',
      owner_id: 'u1',
      theme: {
        preset: 'ivory',
      },
      settings: {
        published: true,
        unlisted: false,
        whitelabel: false,
        gating: {
          enabled: true,
          page_number: 3,
          type: 'email',
          title: 'Unlock',
          description: 'Desc',
        },
      },
    }

    const res = await dispatchLeadWebhook(book, 'lead@test.com')
    expect(res.ok).toBe(false)
    expect(res.error).toBe('No webhook configured')
  })

  it('rejects invalid test webhook URL', async () => {
    const res = await sendTestWebhook('invalid-url')
    expect(res.ok).toBe(false)
    expect(res.error).toBe('Invalid URL format')
  })
})
