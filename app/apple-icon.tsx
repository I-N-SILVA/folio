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
          <g transform="translate(0, -12)">
            <path d="M128 240 C128 240 184 160 256 160 C328 160 384 240 384 240 C384 240 328 320 256 320 C184 320 128 240 128 240 Z" fill="none" stroke="#ffffff" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round"/>
            <circle cx="256" cy="240" r="36" fill="#ffffff"/>
            <path d="M300 280 H380 L436 336 V416 H300 Z" fill="none" stroke="#ffffff" strokeWidth="32" strokeLinejoin="round"/>
            <path d="M380 280 V336 H436" fill="none" stroke="#ffffff" strokeWidth="32" strokeLinecap="round" strokeLinejoin="round"/>
          </g>
        </svg>
      </div>
    ),
    { ...size }
  )
}
