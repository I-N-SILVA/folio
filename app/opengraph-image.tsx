import { ImageResponse } from 'next/og'
import { readFile } from 'fs/promises'
import { join } from 'path'

export const alt = 'KLICKO — Flip through anything'
export const size = { width: 1200, height: 630 }
export const contentType = 'image/png'

export default async function OgImage() {
  const [logo, fraunces] = await Promise.all([
    readFile(join(process.cwd(), 'public/brand/klicko-logo.png')),
    readFile(join(process.cwd(), 'app/_fonts/fraunces-semibold.ttf')),
  ])
  const logoSrc = `data:image/png;base64,${logo.toString('base64')}`

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
          background: '#ffffff',
          fontFamily: 'Fraunces',
        }}
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={logoSrc} alt="" width={196} height={54} style={{ objectFit: 'contain' }} />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: 96, fontWeight: 600, color: '#141a3a', lineHeight: 1.04, letterSpacing: '-0.03em' }}>
            Flip through anything.
          </div>
          <div style={{ marginTop: 24, fontSize: 32, color: '#575d78', maxWidth: 880, lineHeight: 1.3 }}>
            Turn static PDFs into interactive editions — hotspots, analytics, and one-line embeds.
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ height: 10, width: 10, borderRadius: 999, background: '#3c2384' }} />
          <div style={{ fontSize: 24, color: '#575d78' }}>klicko.app</div>
        </div>
      </div>
    ),
    {
      ...size,
      fonts: [{ name: 'Fraunces', data: fraunces, weight: 600, style: 'normal' }],
    }
  )
}
