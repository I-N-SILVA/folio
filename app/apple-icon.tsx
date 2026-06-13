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
          background: '#1d1d1f',
          color: '#ffffff',
          fontSize: 116,
          fontWeight: 600,
          fontFamily: 'Helvetica, Arial, sans-serif',
          letterSpacing: '-0.04em',
        }}
      >
        R
      </div>
    ),
    { ...size }
  )
}
