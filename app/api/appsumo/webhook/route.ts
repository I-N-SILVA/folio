import { NextRequest, NextResponse } from 'next/server'
import {
  APPSUMO_SIGNATURE_HEADER,
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

  if (!verifyAppSumoSignature(raw, signature)) {
    return NextResponse.json({ success: false, message: 'invalid signature' }, { status: 401 })
  }

  let event: AppSumoEvent
  try {
    event = JSON.parse(raw) as AppSumoEvent
  } catch {
    return NextResponse.json({ success: false, message: 'invalid json' }, { status: 400 })
  }

  if (!event.action) {
    return NextResponse.json({ success: false, message: 'missing action' }, { status: 400 })
  }

  try {
    const result = await applyAppSumoEvent(event)
    return NextResponse.json(
      { success: result.ok, message: result.message, event: event.action },
      { status: result.ok ? 200 : 422 }
    )
  } catch (err) {
    console.error('[appsumo webhook]', err)
    return NextResponse.json({ success: false, message: 'internal error' }, { status: 500 })
  }
}
