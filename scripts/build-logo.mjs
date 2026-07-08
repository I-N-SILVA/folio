// Regenerates the QLICO wordmark lockup (public/brand/qlico-logo.png and
// qlico-logo-white.png) from the existing mark artwork + drawn type, so the
// lockup pixels actually say "qlico" instead of the old "klicko" wordmark.
// Run: node scripts/build-logo.mjs
import sharp from 'sharp'
import { readFile, writeFile } from 'node:fs/promises'

const W = 720
const H = 199
const INK = '#141a3a'
const VIOLET = '#3c2384'

async function buildVariant(textColor, outPath) {
  const markBuf = await readFile('public/brand/qlico-mark.png')
  const markB64 = markBuf.toString('base64')

  // Mark scaled to the lockup height, "qlic" set in a bold geometric sans,
  // final "o" hand-drawn as a ring + play triangle to match the brand's
  // signature "the click that flips" treatment.
  const markH = 150
  const markW = markH * (512 / 621)
  const markX = 4
  const markY = (H - markH) / 2

  const textX = markX + markW + 28
  const fontSize = 140
  const baselineY = H / 2 + fontSize * 0.36
  const textWidth = 233.17 // measured bbox of "qlic" at this family/size/weight

  const oR = fontSize * 0.235 // matches lowercase x-height radius, not cap-height
  const oCx = textX + textWidth + oR + 6
  const oCy = baselineY - fontSize * 0.29 // sit on the x-height midline like the other lowercase letters
  const triSize = oR * 0.85

  const svg = `
<svg width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" xmlns="http://www.w3.org/2000/svg">
  <image x="${markX}" y="${markY}" width="${markW}" height="${markH}" href="data:image/png;base64,${markB64}" />
  <text x="${textX}" y="${baselineY}" font-family="DM Sans, Liberation Sans, Arial, sans-serif" font-weight="700" font-size="${fontSize}" fill="${textColor}" letter-spacing="-2">qlic</text>
  <circle cx="${oCx}" cy="${oCy}" r="${oR}" fill="none" stroke="${textColor}" stroke-width="${oR * 0.42}" />
  <path d="M ${oCx - triSize * 0.32} ${oCy - triSize * 0.42} L ${oCx - triSize * 0.32} ${oCy + triSize * 0.42} L ${oCx + triSize * 0.48} ${oCy} Z" fill="${textColor}" />
</svg>`

  // Render oversized, trim the transparent margins to the real content
  // box, then re-pad evenly so the exported canvas hugs the lockup.
  const rendered = await sharp(Buffer.from(svg)).png().toBuffer()
  const pad = 10
  const trimmed = await sharp(rendered).trim().png().toBuffer()
  const meta = await sharp(trimmed).metadata()
  await sharp({
    create: {
      width: meta.width + pad * 2,
      height: meta.height + pad * 2,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: trimmed, left: pad, top: pad }])
    .png()
    .toFile(outPath)
  console.log(`✓ ${outPath} (${meta.width + pad * 2}x${meta.height + pad * 2})`)
}

await buildVariant(INK, 'public/brand/qlico-logo.png')
await buildVariant('#ffffff', 'public/brand/qlico-logo-white.png')
