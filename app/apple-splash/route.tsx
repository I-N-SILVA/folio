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
          gap: Math.round(mark * 0.28),
          background:
            'radial-gradient(circle at 50% 38%, #25201a 0%, #1b1712 58%, #120f0b 100%)',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div
          style={{
            width: mark,
            height: mark,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderRadius: Math.round(mark * 0.26),
            background: 'linear-gradient(145deg, #221a12 0%, #1b1712 55%, #0d6661 150%)',
            color: '#f7ead4',
            fontSize: Math.round(mark * 0.62),
            fontWeight: 700,
            letterSpacing: '-0.06em',
            boxShadow: '0 30px 80px rgba(0,0,0,0.45)',
          }}
        >
          F
        </div>
        <div
          style={{
            color: '#e9d8bd',
            fontSize: Math.round(mark * 0.2),
            fontWeight: 600,
            letterSpacing: '-0.03em',
          }}
        >
          Folio
        </div>
      </div>
    ),
    { width: w, height: h }
  )
}
