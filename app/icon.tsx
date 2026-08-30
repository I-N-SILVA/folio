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
            <path d="M 230 100 C 145 100 84 165 84 250 C 84 335 145 400 230 400 C 315 400 376 335 376 250 C 376 165 315 100 230 100 Z" strokeWidth="36" />
            <path d="M 230 100 C 230 180 290 240 376 240" strokeWidth="36" />
            <path d="M 290 310 L 410 430" strokeWidth="40" />
            <path d="M 340 430 Q 410 430 410 360" strokeWidth="36" />
            <circle cx="230" cy="250" r="14" fill="#ffffff" stroke="none" />
          </g>
        </svg>
      </div>
    ),
    { ...size }
  )
}
