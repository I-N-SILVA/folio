import { ImageResponse } from 'next/og'

export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'linear-gradient(145deg, #221a12 0%, #1b1712 60%, #0d6661 140%)',
          color: '#f7ead4',
          fontSize: 116,
          fontWeight: 700,
          fontFamily: 'Georgia, serif',
          letterSpacing: '-0.06em',
        }}
      >
        F
      </div>
    ),
    { ...size }
  )
}
