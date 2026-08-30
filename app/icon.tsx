import { ImageResponse } from 'next/og'
 
export const runtime = 'edge'
export const size = { width: 512, height: 512 }
export const contentType = 'image/png'
 
export default function Icon() {
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
          borderRadius: '120px',
        }}
      >
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="380" height="380">
          <g fill="none" stroke="#ffffff" strokeLinecap="round" strokeLinejoin="round">
            <path d="M 140 170 C 200 120 312 120 372 170" strokeWidth="40" />
            <path d="M 110 256 H 402" strokeWidth="40" />
            <path d="M 170 342 H 420" strokeWidth="40" />
            <circle cx="256" cy="256" r="14" fill="#000000" stroke="#ffffff" strokeWidth="12" />
          </g>
        </svg>
      </div>
    ),
    { ...size }
  )
}
