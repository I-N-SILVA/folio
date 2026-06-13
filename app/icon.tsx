import { ImageResponse } from 'next/og'

export const size = { width: 512, height: 512 }
export const contentType = 'image/png'

export default function Icon() {
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
          fontSize: 320,
          fontWeight: 600,
          fontFamily: 'Helvetica, Arial, sans-serif',
          letterSpacing: '-0.04em',
          borderRadius: 112,
        }}
      >
        R
      </div>
    ),
    { ...size }
  )
}
