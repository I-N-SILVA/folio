import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const alt = 'QLICO — Publishing, Perfected.'
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
          background: '#050505',
          position: 'relative',
        }}
      >

        <div style={{ fontSize: 48, fontWeight: 400, color: '#ffffff', letterSpacing: '-0.05em' }}>
          QLICO
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', zIndex: 10 }}>
          <div style={{ fontSize: 96, fontWeight: 400, color: '#ffffff', lineHeight: 1.04, letterSpacing: '-0.03em' }}>
            Publishing, <br/><span style={{ color: '#a1a1aa' }}>Perfected.</span>
          </div>
          <div style={{ marginTop: 24, fontSize: 32, color: '#a1a1aa', maxWidth: 880, lineHeight: 1.3 }}>
            Transform static PDFs into immersive, interactive editions.<br/>No code required. Unmatched elegance.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, zIndex: 10 }}>
          <div style={{ height: 10, width: 10, borderRadius: 999, background: '#ffffff' }} />
          <div style={{ fontSize: 24, color: '#a1a1aa' }}>qlico.app</div>
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
