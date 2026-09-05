/**
 * What the app actually renders, in a real browser.
 *
 * This exists because reading the CSS was not enough, twice:
 *
 *   - Every theme preset and every "font pairing" named a Google family the app
 *     never loaded, so four buttons that claimed to change the type produced
 *     identical output. Typecheck, lint and 250 unit tests were green.
 *   - The reader's control bar was 450px wide against a 390px phone, so the
 *     primary surface on the device most links are opened on scrolled sideways.
 *
 * Neither is visible in the source. Both took about a minute here.
 *
 * Usage:
 *   npm run build && npx next start -p 4000 &
 *   node scripts/audit-browser.mjs http://localhost:4000
 *
 * Needs a Chromium. Set CHROME_PATH, or let it try the usual locations.
 * In the cloud dev environment it is at
 * /opt/pw-browsers/chromium-1194/chrome-linux/chrome.
 */

import { existsSync } from 'node:fs'
import { chromium } from 'playwright-core'

const BASE = process.argv[2] ?? 'http://localhost:3000'

const ROUTES = ['/', '/gallery', '/gallery/fashion-lookbook', '/help', '/press', '/login', '/book/demo']

const WIDTHS = [320, 390, 768, 1440]

/**
 * Noise, not findings.
 *
 * `_vercel/insights` only resolves once deployed, and the demo editions point
 * at Unsplash, which a sandboxed network refuses. Both would otherwise drown
 * out everything real on every route.
 */
const IGNORE = /_vercel\/insights|images\.unsplash\.com|vitals\.vercel|\/_next\/image\?url=https/

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const candidates = [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  return candidates.find((p) => existsSync(p))
}

const executablePath = chromePath()
if (!executablePath) {
  console.error('No Chromium found. Set CHROME_PATH to one.')
  process.exit(2)
}

const browser = await chromium.launch({ executablePath })
let findings = 0

for (const width of WIDTHS) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 } })

  for (const route of ROUTES) {
    const page = await ctx.newPage()
    const problems = []

    page.on('pageerror', (e) => problems.push(`uncaught: ${String(e).slice(0, 120)}`))
    page.on('response', (r) => {
      if (r.status() >= 400 && !IGNORE.test(r.url())) {
        problems.push(`${r.status()} ${r.url().replace(BASE, '').slice(0, 70)}`)
      }
    })

    try {
      const res = await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 30000 })
      if (res && res.status() !== 200) problems.push(`status ${res.status()}`)
    } catch (e) {
      problems.push(`navigation: ${String(e).slice(0, 90)}`)
    }
    await page.waitForTimeout(800)

    const probe = await page
      .evaluate(async () => {
        await document.fonts.ready
        const doc = document.documentElement
        const out = { overflow: doc.scrollWidth - doc.clientWidth, wide: [], invisible: [], fellBack: [] }

        // Anything wider than the viewport is what caused the sideways scroll.
        for (const el of document.querySelectorAll('body *')) {
          const r = el.getBoundingClientRect()
          if (r.width > window.innerWidth + 2 && r.height > 0) {
            const cls = (el.className || '').toString().split(' ').slice(0, 3).join(' ')
            out.wide.push(`${el.tagName.toLowerCase()}[${cls}] ${Math.round(r.width)}px`)
            if (out.wide.length >= 2) break
          }
        }

        // Text the same colour as what it sits on — how six editor controls
        // once became invisible from a single token.
        for (const el of document.querySelectorAll('button, a, p, h1, h2, h3, span, label')) {
          if (el.children.length || !(el.textContent || '').trim()) continue
          const cs = getComputedStyle(el)
          if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue
          let bg = 'rgba(0, 0, 0, 0)'
          let n = el
          while (n && bg === 'rgba(0, 0, 0, 0)') {
            bg = getComputedStyle(n).backgroundColor
            n = n.parentElement
          }
          if (bg && cs.color === bg) {
            out.invisible.push((el.textContent || '').trim().slice(0, 30))
            if (out.invisible.length >= 3) break
          }
        }

        // A font that is named but not loaded. The whole reason this file
        // exists: it looks identical in the source and identical in the DOM,
        // and only `document.fonts` can tell you.
        const loaded = new Set([...document.fonts].map((f) => f.family))
        for (const el of document.querySelectorAll('h1, h2, p')) {
          const first = getComputedStyle(el).fontFamily.split(',')[0].replace(/["']/g, '').trim()
          if (!first || /^(system-ui|ui-|sans-serif|serif|monospace|-apple-system|inherit)/.test(first)) continue
          if (!loaded.has(first)) {
            out.fellBack.push(first)
            if (out.fellBack.length >= 2) break
          }
        }

        const broken = [...document.images]
          .filter((i) => i.complete && i.naturalWidth === 0)
          .map((i) => i.currentSrc.slice(0, 60))
        return { ...out, broken: broken.slice(0, 2) }
      })
      .catch((e) => ({ error: String(e).slice(0, 90) }))

    if (probe.error) problems.push(probe.error)
    if (probe.overflow > 1) problems.push(`scrolls sideways by ${probe.overflow}px — ${probe.wide.join(', ')}`)
    if (probe.invisible?.length) problems.push(`text on its own colour: ${probe.invisible.join(' | ')}`)
    if (probe.fellBack?.length) problems.push(`font named but not loaded: ${[...new Set(probe.fellBack)].join(', ')}`)
    if (probe.broken?.length) problems.push(`broken image: ${probe.broken.join(' | ')}`)

    if (problems.length) {
      findings += problems.length
      console.log(`\n  ${String(width).padStart(4)}px  ${route}`)
      for (const p of [...new Set(problems)]) console.log(`         - ${p}`)
    }
    await page.close()
  }
  await ctx.close()
}

await browser.close()
console.log(findings === 0 ? '\nNothing found.' : `\n${findings} finding(s).`)
process.exit(findings === 0 ? 0 : 1)
