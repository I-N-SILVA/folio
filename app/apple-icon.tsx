import { ImageResponse } from 'next/og'
 
export const runtime = 'edge'
export const size = { width: 180, height: 180 }
export const contentType = 'image/png'
 
export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          background: '#050505',
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="128" height="128">
          <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="236" cy="236" r="132" strokeWidth="42" />
            <path d="M 296 296 L 396 396" strokeWidth="42" />
            <path d="M 326 396 H 396 V 326" strokeWidth="42" />
          </g>
        </svg>
      </div>
    ),
    { ...size }
  )
}
