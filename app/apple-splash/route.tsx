import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'

// Generates a branded iOS standalone launch image at an exact device
// resolution. Referenced by the apple-touch-startup-image <link> tags in the
// root layout, e.g. /apple-splash?w=1290&h=2796
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const w = Math.min(Math.max(parseInt(searchParams.get('w') || '1170', 10) || 1170, 320), 4096)
  const h = Math.min(Math.max(parseInt(searchParams.get('h') || '2532', 10) || 2532, 320), 4096)
  const mark = Math.round(Math.min(w, h) * 0.22)

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
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        <div
          style={{
            width: mark,
            height: mark,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: Math.round(mark * 0.24),
            background: '#1d1d1f',
            color: '#ffffff',
            fontSize: Math.round(mark * 0.6),
            fontWeight: 600,
            letterSpacing: '-0.04em',
          }}
        >
          R
        </div>
        <div
          style={{
            color: '#1d1d1f',
            fontSize: Math.round(mark * 0.18),
            fontWeight: 600,
            letterSpacing: '-0.03em',
          }}
        >
          Riffle
        </div>
      </div>
    ),
    { width: w, height: h }
  )
}
