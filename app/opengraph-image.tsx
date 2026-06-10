import { ImageResponse } from 'next/og'

export const alt = 'Folio — Interactive flipbooks with soul'
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
          background:
            'radial-gradient(circle at 78% 18%, rgba(185,130,53,0.30), transparent 46%), radial-gradient(circle at 12% 92%, rgba(13,102,97,0.26), transparent 44%), #f6efe2',
          fontFamily: 'Georgia, serif',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 999,
              background: '#1b1712',
              color: '#f7ead4',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: 42,
              fontWeight: 700,
            }}
          >
            F
          </div>
          <div style={{ fontSize: 40, fontWeight: 700, color: '#1b1712', letterSpacing: '-0.03em' }}>
            Folio
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div
            style={{
              fontSize: 92,
              fontWeight: 700,
              color: '#1b1712',
              lineHeight: 1.0,
              letterSpacing: '-0.05em',
              maxWidth: 980,
            }}
          >
            Make every page feel collected.
          </div>
          <div style={{ marginTop: 28, fontSize: 34, color: '#6f675d', maxWidth: 900, lineHeight: 1.3 }}>
            Turn static PDFs into immersive flipbooks with hotspots, analytics, and one-line embeds.
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16 }}>
          {['Tactile reader', 'Interactive hotspots', 'Reader analytics'].map((tag) => (
            <div
              key={tag}
              style={{
                display: 'flex',
                fontSize: 26,
                fontWeight: 600,
                color: '#1b1712',
                padding: '12px 26px',
                borderRadius: 999,
                border: '2px solid rgba(47,39,29,0.18)',
                background: 'rgba(255,250,240,0.7)',
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { ...size }
  )
}
