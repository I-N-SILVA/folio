import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const dynamic = 'force-static'

// Generates a branded iOS standalone launch image at an exact device
// resolution. Referenced by the apple-touch-startup-image <link> tags in the
// root layout, e.g. /apple-splash?w=1290&h=2796
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const w = Math.min(Math.max(parseInt(searchParams.get('w') || '1170', 10) || 1170, 320), 4096)
  const h = Math.min(Math.max(parseInt(searchParams.get('h') || '2532', 10) || 2532, 320), 4096)
  const mark = Math.round(Math.min(w, h) * 0.22)

  const markPng = await readFile(join(process.cwd(), 'public/brand/qlico-mark.png'))
  const markSrc = `data:image/png;base64,${markPng.toString('base64')}`
  // qlico-mark.png is 512x621 (taller than wide)
  const markW = Math.round(mark * (512 / 621))

  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: Math.round(mark * 0.3),
          background: '#ffffff',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={markSrc} alt="" width={markW} height={mark} style={{ objectFit: 'contain' }} />
        <div
          style={{
            color: '#141a3a',
            fontSize: Math.round(mark * 0.18),
            fontWeight: 600,
            letterSpacing: '-0.03em',
            fontFamily: 'Helvetica, Arial, sans-serif',
          }}
        >
          QLICO
        </div>
      </div>
    ),
    { width: w, height: h }
  )
}
