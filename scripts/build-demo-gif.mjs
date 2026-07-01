// Generates a branded, looping demo GIF for KLICKO using sharp.
// Run: node scripts/build-demo-gif.mjs  → public/klicko-demo.gif
import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'

const W = 760
const H = 475
const SCENES = 4
const FRAMES_PER = 11
const N = SCENES * FRAMES_PER
const DELAY = 80 // ms per frame

const INK = '#1d1d1f'
const MUTED = '#6e6e73'
const ACCENT = '#0066ff'
const PAPER = '#fbfbfd'
const SUBTLE = '#f5f5f7'

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const lerp = (a, b, t) => a + (b - a) * t
const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3)
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')

const SERIF = "Georgia, 'Times New Roman', serif"
const SANS = "Arial, 'Helvetica Neue', sans-serif"

// A faint "page turn" sweep in the last beats of each scene.
function sweep(lp) {
  if (lp < 0.86) return ''
  const p = (lp - 0.86) / 0.14
  const x = lerp(-W * 0.5, W * 1.3, easeOut(p))
  return `<rect x="${x.toFixed(1)}" y="0" width="${(W * 0.5).toFixed(
    1
  )}" height="${H}" fill="url(#sweep)" opacity="0.5"/>`
}

function frameCover(lp) {
  // Rendered fully-formed (no fade-in) so the GIF's poster frame looks finished.
  return `
    <rect width="${W}" height="${H}" fill="${PAPER}"/>
    <text x="${W / 2}" y="153" font-family="${SANS}" font-size="13" letter-spacing="3.2"
      fill="${MUTED}" text-anchor="middle" font-weight="700">VOL. 01 · INTERACTIVE PUBLISHING</text>
    <text x="${W / 2}" y="250" font-family="${SERIF}" font-size="78" fill="${INK}"
      text-anchor="middle" font-weight="600">KLICKO</text>
    <text x="${W / 2}" y="292" font-family="${SANS}" font-size="20" fill="${MUTED}"
      text-anchor="middle">Flip through anything.</text>
    <rect x="${W / 2 - 92}" y="332" width="184" height="46" rx="23" fill="${ACCENT}"/>
    <text x="${W / 2}" y="361" font-family="${SANS}" font-size="15" fill="#fff" text-anchor="middle"
      font-weight="700">Start reading →</text>`
}

function frameTypography(lp) {
  const x = (d) => -lerp(20, 0, easeOut(clamp((lp - d) / 0.4)))
  const op = (d) => clamp((lp - d) / 0.3)
  return `
    <rect width="${W}" height="${H}" fill="#ffffff"/>
    <rect x="${W * 0.52}" y="0" width="${W * 0.48}" height="${H}" fill="${SUBTLE}"/>
    <text x="${W * 0.55}" y="${H / 2 - 6}" font-family="${SERIF}" font-size="120" fill="#dcdce1"
      font-weight="600">Aa</text>
    <g transform="translate(${x(0)},0)" opacity="${op(0)}">
      <text x="56" y="180" font-family="${SERIF}" font-size="38" fill="${INK}" font-weight="600">Typography</text>
      <text x="56" y="224" font-family="${SERIF}" font-size="38" fill="${INK}" font-weight="600">that reads</text>
      <text x="56" y="268" font-family="${SERIF}" font-size="38" fill="${INK}" font-weight="600">like print</text>
    </g>
    <g opacity="${op(0.35)}">
      <rect x="56" y="300" width="3" height="54" fill="${ACCENT}"/>
      <text x="74" y="322" font-family="${SERIF}" font-size="17" font-style="italic" fill="${MUTED}">The best documents</text>
      <text x="74" y="346" font-family="${SERIF}" font-size="17" font-style="italic" fill="${MUTED}">feel considered.</text>
    </g>`
}

function frameAnalytics(lp) {
  const grow = easeOut(clamp(lp / 0.55))
  const op = (d) => clamp((lp - d) / 0.3)
  const heights = [44, 72, 56, 92, 66, 104, 80]
  const baseX = 56
  const bw = 34
  const gap = 16
  const floor = 400
  let bars = ''
  heights.forEach((h, i) => {
    const hh = h * grow
    bars += `<rect x="${baseX + i * (bw + gap)}" y="${floor - hh}" width="${bw}" height="${hh}" rx="4" fill="${ACCENT}"/>`
  })
  const num = Math.round(10 * easeOut(clamp(lp / 0.6)))
  return `
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="56" y="116" font-family="${SERIF}" font-size="38" fill="#fff" font-weight="600" opacity="${op(0)}">Numbers that land</text>
    <text x="${W - 56}" y="120" font-family="${SERIF}" font-size="68" fill="${ACCENT}" font-weight="600"
      text-anchor="end" opacity="${op(0)}">${num}×</text>
    ${bars}
    <text x="56" y="436" font-family="${SANS}" font-size="15" fill="rgba(255,255,255,0.6)" opacity="${op(0.4)}">More engaging than a static PDF — measured, every time.</text>`
}

function frameCta(lp) {
  const rise = (d) => (1 - easeOut(clamp((lp - d) / 0.35))) * 22
  const op = (d) => clamp((lp - d) / 0.3)
  return `
    <rect width="${W}" height="${H}" fill="${INK}"/>
    <text x="${W / 2}" y="${200 + rise(0)}" font-family="${SERIF}" font-size="46" fill="#fff"
      text-anchor="middle" font-weight="600" opacity="${op(0)}">Your next publication</text>
    <text x="${W / 2}" y="${252 + rise(0.1)}" font-family="${SERIF}" font-size="46" fill="#fff"
      text-anchor="middle" font-weight="600" opacity="${op(0.1)}">deserves more.</text>
    <g opacity="${op(0.3)}" transform="translate(0,${rise(0.3)})">
      <rect x="${W / 2 - 96}" y="296" width="192" height="48" rx="24" fill="#fff"/>
      <text x="${W / 2}" y="326" font-family="${SANS}" font-size="15" fill="${INK}" text-anchor="middle"
        font-weight="700">Start for free →</text>
    </g>
    <text x="${W / 2}" y="${384 + rise(0.4)}" font-family="${SANS}" font-size="14" fill="rgba(255,255,255,0.5)"
      text-anchor="middle" opacity="${op(0.4)}">klicko.app</text>`
}

function svgFor(i) {
  const scene = Math.floor(i / FRAMES_PER)
  const lp = (i % FRAMES_PER) / (FRAMES_PER - 1)
  const body =
    scene === 0 ? frameCover(lp) : scene === 1 ? frameTypography(lp) : scene === 2 ? frameAnalytics(lp) : frameCta(lp)
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}">
    <defs>
      <linearGradient id="sweep" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0" stop-color="${ACCENT}" stop-opacity="0"/>
        <stop offset="0.5" stop-color="${ACCENT}" stop-opacity="0.5"/>
        <stop offset="1" stop-color="${ACCENT}" stop-opacity="0"/>
      </linearGradient>
    </defs>
    ${body}
    ${sweep(lp)}
  </svg>`
}

async function main() {
  await mkdir('public', { recursive: true })
  const frames = []
  for (let i = 0; i < N; i++) {
    const png = await sharp(Buffer.from(svgFor(i))).png().toBuffer()
    frames.push(png)
  }
  await sharp(frames, { join: { across: 1, animated: true } })
    .gif({ loop: 0, delay: Array(N).fill(DELAY) })
    .toFile('public/klicko-demo.gif')
  console.log(`✓ public/klicko-demo.gif  (${N} frames, ${W}×${H})`)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
