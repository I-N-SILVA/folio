import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { sendTestWebhook } from '@/lib/webhooks'
import { rateLimit, clientIp } from '@/lib/rate-limit'

const TestSchema = z.object({
  url: z.string().url(),
  title: z.string().optional(),
  slug: z.string().optional(),
})

export async function POST(request: NextRequest) {
  const limit = rateLimit(`webhook-test:${clientIp(request)}`, 10, 60_000)
  if (!limit.ok) {
    return NextResponse.json(
      { error: 'Too many test requests. Please wait a moment.' },
      { status: 429 }
    )
  }

  const parsed = TestSchema.safeParse(await request.json().catch(() => null))
  if (!parsed.success) {
    return NextResponse.json({ error: 'A valid target webhook URL is required.' }, { status: 400 })
  }

  const { url, title, slug } = parsed.data
  const result = await sendTestWebhook(url, title, slug)

  if (!result.ok) {
    return NextResponse.json(
      { error: result.error || 'Failed to deliver webhook payload.' },
      { status: 400 }
    )
  }

  return NextResponse.json({ success: true, status: result.status })
}
