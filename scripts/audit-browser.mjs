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

// Both themes. The palette inverts, and the contrast bug this catches was
// legible in light and white-on-white in dark — checking one theme is checking
// half the app.
for (const { width, scheme } of WIDTHS.flatMap((width) =>
  [/** @type {const} */ ('light'), /** @type {const} */ ('dark')].map((scheme) => ({ width, scheme }))
)) {
  const ctx = await browser.newContext({ viewport: { width, height: 900 }, colorScheme: scheme })

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

        // Contrast, not equality. An exact colour match catches white-on-white
        // and nothing else; the failure that actually shipped was a background
        // token that inverts between themes paired with a fixed `text-white`,
        // and its near neighbours (#fff on #eee) are just as unreadable.
        // 3.0 rather than WCAG's 4.5 so this reports what is genuinely
        // illegible rather than every low-contrast caption.
        const channel = (c) => {
          const v = c / 255
          return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
        }
        const luminance = (rgb) =>
          0.2126 * channel(rgb[0]) + 0.7152 * channel(rgb[1]) + 0.0722 * channel(rgb[2])
        // Resolved through a canvas rather than parsed out of the string.
        //
        // Chrome serves computed colours in whatever space the author wrote —
        // Tailwind v4 emits `oklch(...)` and `color-mix()` yields `oklab(...)`.
        // Scraping digits out of those treats 286.067 as a blue channel, which
        // reported the site navigation at 2.8:1 and black-on-white at 1.0:1.
        // Both were wrong, and a detector that cries wolf is worse than none.
        //
        // Painting the colour and reading the pixel back makes the browser do
        // the conversion, so every format works.
        const probeCanvas = document.createElement('canvas')
        probeCanvas.width = probeCanvas.height = 1
        const ctx2d = probeCanvas.getContext('2d', { willReadFrequently: true })
        const cache = new Map()
        const SENTINEL = '#010203'

        /** `[r, g, b, a]` with a in 0..1, or null if the value is not a colour. */
        const rgba = (value) => {
          if (!value) return null
          if (cache.has(value)) return cache.get(value)
          let out = null
          try {
            // Assigning an invalid colour leaves fillStyle untouched, which is
            // how it is detected without relying on an exception.
            ctx2d.fillStyle = SENTINEL
            ctx2d.fillStyle = value
            if (ctx2d.fillStyle !== SENTINEL || value.trim().toLowerCase() === SENTINEL) {
              ctx2d.clearRect(0, 0, 1, 1)
              ctx2d.fillRect(0, 0, 1, 1)
              const d = ctx2d.getImageData(0, 0, 1, 1).data
              out = [d[0], d[1], d[2], d[3] / 255]
            }
          } catch {
            out = null
          }
          cache.set(value, out)
          return out
        }

        const over = (fg, bg) => [
          fg[0] * fg[3] + bg[0] * (1 - fg[3]),
          fg[1] * fg[3] + bg[1] * (1 - fg[3]),
          fg[2] * fg[3] + bg[2] * (1 - fg[3]),
        ]

        /**
         * What is actually behind this element.
         *
         * Taking the first non-transparent ancestor background is wrong when it
         * is translucent — a 90%-white bar over a dark page is not white — so
         * the translucent layers are collected and composited down onto the
         * first opaque one.
         */
        const backdrop = (el) => {
          const layers = []
          let n = el
          let base = null
          while (n) {
            const c = rgba(getComputedStyle(n).backgroundColor)
            if (c && c[3] > 0.001) {
              if (c[3] >= 0.999) {
                base = [c[0], c[1], c[2]]
                break
              }
              layers.push(c)
            }
            n = n.parentElement
          }
          if (!base) {
            const html = rgba(getComputedStyle(document.documentElement).backgroundColor)
            base = html && html[3] >= 0.999 ? [html[0], html[1], html[2]] : [255, 255, 255]
          }
          for (let i = layers.length - 1; i >= 0; i--) base = over(layers[i], base)
          return base
        }

        const ratio = (a, b) => {
          const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x)
          return (l1 + 0.05) / (l2 + 0.05)
        }

        for (const el of document.querySelectorAll('button, a, p, h1, h2, h3, span, label')) {
          if (el.children.length || !(el.textContent || '').trim()) continue
          const cs = getComputedStyle(el)
          if (cs.visibility === 'hidden' || cs.display === 'none') continue
          // A deliberately faded element is a design choice, not a defect.
          if (Number(cs.opacity) < 0.6) continue
          // Nor is decorative text. The landing page sets its own wordmark at
          // 20vw in near-black as a background flourish; it is `aria-hidden`
          // and `pointer-events-none` precisely because it is not there to be
          // read, and reporting it teaches the reader to ignore this tool.
          if (el.closest('[aria-hidden="true"]')) continue
          if (cs.pointerEvents === 'none' && !el.closest('button, a')) continue
          const rect = el.getBoundingClientRect()
          if (rect.width === 0 || rect.height === 0) continue
          // Text over a picture is judged by the picture, which this cannot see.
          let hasImage = false
          for (let n = el; n; n = n.parentElement) {
            if (getComputedStyle(n).backgroundImage !== 'none') { hasImage = true; break }
          }
          if (hasImage) continue

          const fgRaw = rgba(cs.color)
          if (!fgRaw || fgRaw[3] < 0.05) continue
          const bg = backdrop(el)
          const fg = over(fgRaw, bg)

          const r = ratio(fg, bg)
          if (r < 3) {
            out.invisible.push(`${(el.textContent || '').trim().slice(0, 26)} (${r.toFixed(1)}:1)`)
            if (out.invisible.length >= 4) break
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
          .map((i) => i.currentSrc)
        return { ...out, broken }
      })
      .catch((e) => ({ error: String(e).slice(0, 90) }))

    if (probe.error) problems.push(probe.error)
    if (probe.overflow > 1) problems.push(`scrolls sideways by ${probe.overflow}px — ${probe.wide.join(', ')}`)
    if (probe.invisible?.length) problems.push(`unreadable contrast: ${probe.invisible.join(' | ')}`)
    if (probe.fellBack?.length) problems.push(`font named but not loaded: ${[...new Set(probe.fellBack)].join(', ')}`)
    // The same IGNORE as the response filter: the demo editions point at
    // Unsplash, which a sandboxed network refuses, and reporting that on every
    // route buries the findings that are real.
    const broken = (probe.broken ?? []).filter((u) => !IGNORE.test(u)).slice(0, 2)
    if (broken.length) problems.push(`broken image: ${broken.map((u) => u.slice(0, 60)).join(' | ')}`)

    if (problems.length) {
      findings += problems.length
      console.log(`\n  ${String(width).padStart(4)}px ${scheme.padEnd(5)} ${route}`)
      for (const p of [...new Set(problems)]) console.log(`         - ${p}`)
    }
    await page.close()
  }
  await ctx.close()
}

await browser.close()
console.log(findings === 0 ? '\nNothing found.' : `\n${findings} finding(s).`)
process.exit(findings === 0 ? 0 : 1)
