import { ImageResponse } from 'next/og'

export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#1d1d1f',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            color: 'white',
            fontSize: 100,
            fontWeight: 700,
            fontFamily: 'sans-serif',
            letterSpacing: '-0.04em',
            paddingRight: '4px'
          }}
        >
          K
        </div>
      </div>
    ),
    { ...size }
  )
}
