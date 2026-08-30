import { ImageResponse } from 'next/og'

export const dynamic = 'force-static'

// Generates a branded iOS standalone launch image at an exact device
// resolution. Referenced by the apple-touch-startup-image <link> tags in the
// root layout, e.g. /apple-splash?w=1290&h=2796
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const w = Math.min(Math.max(parseInt(searchParams.get('w') || '1170', 10) || 1170, 320), 4096)
  const h = Math.min(Math.max(parseInt(searchParams.get('h') || '2532', 10) || 2532, 320), 4096)
  const markSize = Math.round(Math.min(w, h) * 0.22)

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
          gap: Math.round(markSize * 0.2),
          background: '#050505',
        }}
      >
        <svg
          xmlns="http://www.w3.org/2000/svg"
          viewBox="0 0 512 512"
          width={markSize}
          height={markSize}
        >
          <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="236" cy="236" r="132" strokeWidth="44" />
            <path d="M 296 296 L 396 396" strokeWidth="44" />
            <path d="M 326 396 H 396 V 326" strokeWidth="44" />
          </g>
        </svg>
        <div
          style={{
            color: '#ffffff',
            fontSize: Math.round(markSize * 0.22),
            fontWeight: 800,
            letterSpacing: '-0.05em',
            fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          }}
        >
          QLICO
        </div>
      </div>
    ),
    { width: w, height: h }
  )
}
