import { ImageResponse } from 'next/og'

export const alt = 'KLICKO — Flip through anything'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default function OgImage() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: 80,
          background: '#ffffff',
          fontFamily: 'Helvetica, Arial, sans-serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div
            style={{
              width: 56,
              height: 56,
              borderRadius: 14,
              background: '#1d1d1f',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 34,
              fontWeight: 600,
            }}
          >
            K
          </div>
          <div style={{ fontSize: 34, fontWeight: 600, color: '#1d1d1f', letterSpacing: '-0.02em' }}>KLICKO</div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 96, fontWeight: 600, color: '#1d1d1f', lineHeight: 1.02, letterSpacing: '-0.04em' }}>
            Flip through anything.
          </div>
          <div style={{ marginTop: 24, fontSize: 32, color: '#6e6e73', maxWidth: 880, lineHeight: 1.3 }}>
            Turn static PDFs into interactive editions — hotspots, analytics, and one-line embeds.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ height: 10, width: 10, borderRadius: 999, background: '#0066ff' }} />
          <div style={{ fontSize: 24, color: '#6e6e73' }}>klicko.app</div>
        </div>
      </div>
    ),
    { ...size }
  )
}
