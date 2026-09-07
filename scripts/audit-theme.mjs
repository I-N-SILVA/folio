/**
 * Which surfaces do not change when the theme does.
 *
 * `docs/editor-redesign-spec.md` §9.1 is the last unshipped item of the
 * redesign: the studio still hardcodes `neutral-*` in ~540 places, and the note
 * beside it says to do the sweep "with a screenshot diff, not by hand" because
 * a blind pass over 2,000 lines of JSX has real regression risk and nothing to
 * catch a mistake.
 *
 * This is that instrument, and it measures the thing that actually matters
 * rather than pixels. A token-driven colour resolves differently under
 * `prefers-color-scheme: light` and `dark`; a hardcoded one resolves to the
 * same value in both. So: render the page twice, walk the DOM in the same order
 * each time, and report every element whose colour is byte-identical across the
 * two — those are the surfaces that stay light when the author's system is
 * dark. Contrast in the dark render is checked at the same time, because a
 * fixed foreground over a token background is how text disappears.
 *
 * Signed-in routes need a session; `scripts/harness-session.mjs` prints the
 * Cookie header for one and `--cookie` takes it.
 *
 *   node scripts/audit-theme.mjs http://127.0.0.1:5804 \
 *     --routes /editor/<id>,/dashboard --cookie "$(cat cookie.txt)"
 *
 * `--json <file>` writes the full per-element record, so a sweep can be diffed
 * against the run that preceded it rather than eyeballed.
 */

import { existsSync, writeFileSync } from 'node:fs'
import { chromium } from 'playwright-core'

const BASE = process.argv[2] ?? 'http://localhost:3000'
const arg = (name, fallback) => {
  const i = process.argv.indexOf(`--${name}`)
  return i === -1 ? fallback : process.argv[i + 1]
}

const ROUTES = arg('routes', '/dashboard,/account').split(',').filter(Boolean)
/**
 * Routes that are deliberately one theme.
 *
 * The studio is a dark room on purpose — `bg-neutral-950 text-neutral-100` at
 * its root, the way an editing tool usually is — so on those routes an element
 * that renders identically under both schemes is the design, and only contrast
 * is worth reporting. Naming them explicitly is the point: it is the difference
 * between "this surface chose one theme" and "this surface forgot there were
 * two".
 */
const DARK_ONLY = new Set(arg('dark-only', '').split(',').filter(Boolean))
const COOKIE = arg('cookie', '')
const JSON_OUT = arg('json', '')
const WIDTH = Number(arg('width', 1440))

function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  return [
    '/opt/pw-browsers/chromium-1194/chrome-linux/chrome',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
  ].find((p) => existsSync(p))
}

const executablePath = chromePath()
if (!executablePath) {
  console.error('No Chromium found. Set CHROME_PATH to one.')
  process.exit(2)
}

/**
 * Read every visible element's colours, keyed by its position in the tree.
 *
 * The key has to be identical across the two renders or nothing lines up, so it
 * is the child-index chain rather than anything about the element's own
 * content. Text nodes are what a reader sees, so an element only counts as
 * carrying a foreground colour when it has text of its own.
 *
 * Every colour is resolved through a 1x1 canvas before it leaves the page.
 * Chrome serves computed colours in whatever space the author wrote, and
 * Tailwind v4 writes `oklch(...)`: scraping digits out of `oklch(0.556 0 0)`
 * reads 0.556 as a red channel, which is how the first run of this script
 * reported the entire editor at a flat 1:1. `scripts/audit-browser.mjs` already
 * carries this scar; painting the colour and reading the pixel back is the same
 * fix, and it makes every format work.
 */
const COLLECT = () => {
  const probe = document.createElement('canvas')
  probe.width = probe.height = 1
  const ctx = probe.getContext('2d', { willReadFrequently: true })
  const cache = new Map()
  const SENTINEL = '#010203'

  /** `[r, g, b, a]` with a in 0..1, or null when the value is not a colour. */
  const rgba = (value) => {
    if (!value) return null
    if (cache.has(value)) return cache.get(value)
    let out = null
    try {
      // An invalid colour leaves fillStyle untouched — that is the detection,
      // rather than relying on a throw that never comes.
      ctx.fillStyle = SENTINEL
      ctx.fillStyle = value
      if (ctx.fillStyle !== SENTINEL || value.trim().toLowerCase() === SENTINEL) {
        ctx.clearRect(0, 0, 1, 1)
        ctx.fillRect(0, 0, 1, 1)
        const d = ctx.getImageData(0, 0, 1, 1).data
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
    1,
  ]

  /** What is actually behind this element, composited up through its ancestors. */
  const groundOf = (el) => {
    const layers = []
    for (let n = el; n; n = n.parentElement) {
      const c = rgba(getComputedStyle(n).backgroundColor)
      if (!c || c[3] === 0) continue
      layers.push(c)
      if (c[3] === 1) break
    }
    let acc = [255, 255, 255, 1]
    for (const l of layers.reverse()) acc = over(l, acc)
    return acc
  }

  const out = []
  const walk = (el, path) => {
    // A subtree that paints its own palette on purpose — an edition's page
    // renders the *book's* theme, not the app's, so "identical in light and
    // dark" is the requirement there rather than a finding.
    if (el.hasAttribute && el.hasAttribute('data-own-theme')) return
    const style = getComputedStyle(el)
    if (style.display === 'none' || style.visibility === 'hidden') return
    const box = el.getBoundingClientRect()
    if (box.width === 0 || box.height === 0) return

    const ownText = [...el.childNodes]
      .filter((n) => n.nodeType === 3 && n.textContent.trim())
      .map((n) => n.textContent.trim())
      .join(' ')
      .slice(0, 60)

    const size = parseFloat(style.fontSize) || 16
    const weight = Number(style.fontWeight) || 400

    out.push({
      path,
      tag: el.tagName.toLowerCase(),
      text: ownText,
      cls: (typeof el.className === 'string' ? el.className : '').slice(0, 200),
      color: rgba(style.color),
      background: rgba(style.backgroundColor),
      ground: groundOf(el),
      // WCAG's "large text" exemption: 24px, or 18.66px at 700+.
      large: size >= 24 || (size >= 18.66 && weight >= 700),
      area: Math.round(box.width * box.height),
    })
    ;[...el.children].forEach((child, i) => walk(child, `${path}/${i}`))
  }
  walk(document.body, '0')
  return out
}

const browser = await chromium.launch({ executablePath })

async function render(route, scheme) {
  const context = await browser.newContext({
    viewport: { width: WIDTH, height: 900 },
    colorScheme: scheme,
  })
  if (COOKIE) {
    const url = new URL(BASE)
    await context.addCookies(
      COOKIE.split(';')
        .map((c) => c.trim())
        .filter(Boolean)
        .map((c) => {
          const eq = c.indexOf('=')
          return {
            name: c.slice(0, eq),
            value: c.slice(eq + 1),
            domain: url.hostname,
            path: '/',
          }
        })
    )
  }
  const page = await context.newPage()
  await page.goto(BASE + route, { waitUntil: 'networkidle', timeout: 45000 })
  // The studio hydrates and then paints; a bare load can catch it mid-swap.
  await page.waitForTimeout(1200)
  const collected = await page.evaluate(COLLECT)
  await context.close()
  return collected
}

/** sRGB relative luminance from a resolved `[r, g, b, a]`. */
function luminance(rgb) {
  const ch = (v) => {
    const s = v / 255
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
  }
  return 0.2126 * ch(rgb[0]) + 0.7152 * ch(rgb[1]) + 0.0722 * ch(rgb[2])
}

/** Contrast of text over the ground it was measured against. */
function contrast(fg, ground) {
  if (!fg || !ground) return null
  // Translucent text is painted onto its own ground before it is judged.
  const solid =
    fg[3] === 1
      ? fg
      : [
          fg[0] * fg[3] + ground[0] * (1 - fg[3]),
          fg[1] * fg[3] + ground[1] * (1 - fg[3]),
          fg[2] * fg[3] + ground[2] * (1 - fg[3]),
          1,
        ]
  const a = luminance(solid)
  const b = luminance(ground)
  const [hi, lo] = a > b ? [a, b] : [b, a]
  return (hi + 0.05) / (lo + 0.05)
}

const invisible = (c) => !c || c[3] === 0
const same = (a, b) => JSON.stringify(a) === JSON.stringify(b)

const report = []
let frozen = 0
let unreadable = 0

for (const route of ROUTES) {
  let light, dark
  try {
    light = await render(route, 'light')
    dark = await render(route, 'dark')
  } catch (err) {
    console.log(`\n  ${route} — could not render: ${err.message.split('\n')[0]}`)
    continue
  }

  const byPath = new Map(light.map((n) => [n.path, n]))
  const findings = []

  dark.forEach((node) => {
    const twin = byPath.get(node.path)
    if (!twin) return

    // Only elements that paint something worth seeing. A 0-area or fully
    // transparent element that also has no text cannot be looked at.
    const paints = !invisible(node.background)
    const writes = node.text.length > 0 && !invisible(node.color)
    if (!paints && !writes) return
    if (node.area < 200) return

    const sameBg = paints && same(node.background, twin.background)
    const sameFg = writes && same(node.color, twin.color)
    if ((sameBg || sameFg) && !DARK_ONLY.has(route)) {
      frozen++
      findings.push({
        kind: 'frozen',
        ...node,
        what: [sameBg && 'background', sameFg && 'text'].filter(Boolean).join(' + '),
      })
    }

    if (writes) {
      const ratio = contrast(node.color, node.ground)
      // AA: 4.5:1 for body text, 3:1 once it is large enough to read anyway.
      const floor = node.large ? 3 : 4.5
      if (ratio !== null && ratio < floor) {
        unreadable++
        findings.push({ kind: 'unreadable', ...node, ratio: Number(ratio.toFixed(2)) })
      }
    }
  })

  report.push({ route, findings })

  console.log(`\n  ${route}${DARK_ONLY.has(route) ? '  (dark-only: contrast only)' : ''}`)
  if (findings.length === 0) {
    console.log(
      DARK_ONLY.has(route)
        ? '    every element reads against what is actually behind it'
        : '    everything moves with the theme, and reads in dark'
    )
    continue
  }
  const shown = new Map()
  for (const f of findings) {
    // One line per distinct class list: 540 hardcoded classes produce thousands
    // of elements, and the class list is what actually gets edited.
    const key = `${f.kind}|${f.cls}`
    if (shown.has(key)) {
      shown.get(key).count++
      continue
    }
    shown.set(key, { ...f, count: 1 })
  }
  for (const f of [...shown.values()].sort((a, b) => b.area * b.count - a.area * a.count)) {
    const label =
      f.kind === 'frozen'
        ? `does not change with the theme (${f.what})`
        : `unreadable in dark (${f.ratio}:1)`
    const where = f.text ? `"${f.text}"` : `<${f.tag}>`
    console.log(`    ${String(f.count).padStart(3)}× ${label} — ${where}`)
    if (f.cls) console.log(`         ${f.cls.slice(0, 150)}`)
  }
}

await browser.close()

if (JSON_OUT) {
  writeFileSync(JSON_OUT, JSON.stringify(report, null, 2))
  console.log(`\n  wrote ${JSON_OUT}`)
}

console.log(`\n  ${frozen} element(s) frozen against the theme, ${unreadable} unreadable in dark.`)
process.exit(frozen + unreadable > 0 ? 1 : 0)
