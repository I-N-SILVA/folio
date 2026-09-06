import { NextRequest, NextResponse } from 'next/server'
import {
  APPSUMO_SIGNATURE_HEADER,
  APPSUMO_TIMESTAMP_HEADER,
  applyAppSumoEvent,
  verifyAppSumoSignature,
  type AppSumoEvent,
} from '@/lib/appsumo'

// AppSumo posts license lifecycle events here. Configure this URL as the
// "Notification URL" in the AppSumo partner dashboard:
//   https://<your-domain>/api/appsumo/webhook

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

// Health check — AppSumo (and uptime monitors) may GET this endpoint.
export async function GET() {
  return NextResponse.json({ ok: true, service: 'folio-appsumo-webhook' })
}

export async function POST(request: NextRequest) {
  const raw = await request.text()
  const signature = request.headers.get(APPSUMO_SIGNATURE_HEADER)
  // v2 signs the timestamp in front of the body; v1 signs the body alone.
  const timestamp = request.headers.get(APPSUMO_TIMESTAMP_HEADER)

  if (!verifyAppSumoSignature(raw, signature, timestamp)) {
    return NextResponse.json({ success: false, message: 'invalid signature' }, { status: 401 })
  }

  let event: AppSumoEvent
  try {
    event = JSON.parse(raw) as AppSumoEvent
  } catch {
    return NextResponse.json({ success: false, message: 'invalid json' }, { status: 400 })
  }

  // Both payload shapes: v1 sends `action`, v2 sends `event`. This used to
  // require `action`, so a v2 deal had every one of its webhooks rejected with
  // a 400 and no licence was ever created. See `normalizeAction`.
  const verb = event.event ?? event.action
  if (!verb) {
    return NextResponse.json({ success: false, message: 'missing event' }, { status: 400 })
  }

  try {
    const result = await applyAppSumoEvent(event)
    return NextResponse.json(
      { success: result.ok, message: result.message, event: verb },
      { status: result.ok ? 200 : 422 }
    )
  } catch (err) {
    console.error('[appsumo webhook]', err)
    return NextResponse.json({ success: false, message: 'internal error' }, { status: 500 })
  }
}
