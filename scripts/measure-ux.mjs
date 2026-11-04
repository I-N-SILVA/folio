/**
 * The UX measurements behind the responsive and studio fixes, as one run.
 *
 *   npm run measure:ux          (starts everything it needs; see measure-ux.sh)
 *
 * Every check is a number with a pass line, so "it looks fine" is never the
 * evidence. Two of them were wrong before they were right, which is the point
 * of keeping them: the contrast check read Tailwind v4's oklab() colours as
 * transparent until colours went through the browser's own conversion, and the
 * clipped-text check was proven by switching the fix off and watching it fail.
 *
 * Expects: BASE (app URL), COOKIE (a signed-in author's Cookie header, from
 * scripts/harness-session.mjs) and the studio served by studio-mock-rest.mjs.
 */
import { chromium } from 'playwright-core'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'

/**
 * The Chromium to drive. Looked for rather than hard-coded to one build
 * number: the dev container's browser moves with its Playwright version
 * (chromium-1194 in audit-browser.mjs's list is gone from today's image).
 */
function chromePath() {
  if (process.env.CHROME_PATH) return process.env.CHROME_PATH
  const fixed = [
    '/opt/pw-browsers/chromium',
    '/usr/bin/chromium',
    '/usr/bin/google-chrome',
    '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  ]
  const found = fixed.find((p) => fs.existsSync(p))
  if (found) return found
  const root = '/opt/pw-browsers'
  if (!fs.existsSync(root)) return undefined
  for (const dir of fs
    .readdirSync(root)
    .filter((d) => d.startsWith('chromium-'))
    .sort()
    .reverse()) {
    for (const sub of ['chrome-linux64/chrome', 'chrome-linux/chrome']) {
      const p = path.join(root, dir, sub)
      if (fs.existsSync(p)) return p
    }
  }
  return undefined
}
const executablePath = chromePath()
if (!executablePath) {
  console.error('No Chromium found. Set CHROME_PATH to one.')
  process.exit(2)
}

const BASE = process.env.BASE ?? 'http://localhost:3100'
const cookie = (process.env.COOKIE ?? '').trim()
if (!cookie) {
  console.error('COOKIE is required (a signed-in Cookie header)')
  process.exit(2)
}
const [cname, ...crest] = cookie.split('=')
const EDITOR = '/editor/a1111111-1111-4111-8111-111111111111'
const out = []
const log = (area, size, check, value, ok) => {
  out.push({ area, size, check, value, ok })
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${area.padEnd(9)} ${size.padEnd(10)} ${check}: ${value}`)
}

// A two-page PDF, written by hand, for the home page's try-it preview.
function samplePdf() {
  const objs = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R 5 0 R] /Count 2 >>',
  ]
  const page = (c) =>
    `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents ${c} 0 R /Resources << /Font << /F1 7 0 R >> >> >>`
  const stream = (t, y) => {
    const s = `BT /F1 36 Tf 72 ${y} Td (${t}) Tj ET`
    return `<< /Length ${s.length} >>\nstream\n${s}\nendstream`
  }
  objs.push(
    page(4),
    stream('Spring Catalog', 700),
    page(6),
    stream('Page two', 600),
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'
  )
  let pdf = '%PDF-1.4\n'
  const offs = []
  objs.forEach((o, i) => {
    offs.push(Buffer.byteLength(pdf))
    pdf += `${i + 1} 0 obj\n${o}\nendobj\n`
  })
  const xref = Buffer.byteLength(pdf)
  pdf +=
    `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n` +
    offs.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')
  pdf += `trailer\n<< /Size ${objs.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  const file = path.join(os.tmpdir(), 'qlico-measure-sample.pdf')
  fs.writeFileSync(file, pdf)
  return file
}
const SAMPLE_PDF = samplePdf()

;(async () => {
  const b = await chromium.launch({ executablePath })

  // 0. Reader layout: the page ends above the filmstrip, the filmstrip above
  //    the toolbar, nothing scrolls; and no text spills off a page.
  for (const [w, h, m] of [
    [1024, 768],
    [1280, 720],
    [1440, 900],
    [1920, 1080],
    [390, 844, 1],
    [768, 1024, 1],
  ]) {
    const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: !!m, hasTouch: !!m })
    await p.goto(BASE + '/book/demo', { waitUntil: 'networkidle' })
    await p.waitForTimeout(1500)
    await p.keyboard.press('ArrowRight')
    await p.waitForTimeout(1500)
    const r = await p.evaluate(() => {
      const book = document.querySelector('[class*="stf__"]')?.closest('div[style*="translateX"]')
      const bar = [...document.querySelectorAll('div')].find((d) =>
        String(d.className).includes('sticky bottom-4')
      )
      const strip = [...document.querySelectorAll('button')].find((x) =>
        (x.getAttribute('aria-label') || '').startsWith('Jump to page')
      )
      const bb = book.getBoundingClientRect(),
        tb = bar.getBoundingClientRect()
      const sb = strip && strip.getClientRects().length ? strip.getBoundingClientRect() : null
      return {
        bookBottom: bb.bottom,
        barTop: tb.top,
        stripBottom: sb ? sb.bottom : null,
        scroll: document.documentElement.scrollHeight - innerHeight,
        overflowX: document.documentElement.scrollWidth - innerWidth,
      }
    })
    const clear = r.bookBottom <= (r.stripBottom ?? r.barTop) && (r.stripBottom ?? 0) <= r.barTop
    log(
      'reader',
      `${w}x${h}`,
      'page, filmstrip and toolbar do not overlap',
      clear ? 'clear' : JSON.stringify(r),
      clear
    )
    log(
      'reader',
      `${w}x${h}`,
      'scrolls (vertical / sideways px)',
      `${r.scroll} / ${r.overflowX}`,
      r.scroll <= 0 && r.overflowX <= 0
    )
    await p.close()
  }
  for (const slug of ['demo', 'demo-lookbook', 'demo-report']) {
    for (const [w, h, m] of [
      [1280, 720],
      [1024, 768],
      [1440, 900],
      [390, 844, 1],
    ]) {
      const p = await b.newPage({ viewport: { width: w, height: h }, isMobile: !!m, hasTouch: !!m })
      await p.goto(BASE + '/book/' + slug, { waitUntil: 'networkidle' })
      await p.waitForTimeout(1500)
      let clipped = 0,
        checked = 0
      for (let step = 0; step < 6; step++) {
        const r = await p.evaluate(() => {
          let c = 0,
            n = 0
          for (const pg of document.querySelectorAll('.stf__item')) {
            const pr = pg.getBoundingClientRect()
            if (
              pr.width < 10 ||
              getComputedStyle(pg).display === 'none' ||
              pr.right < 0 ||
              pr.left > innerWidth
            )
              continue
            for (const el of pg.querySelectorAll('h1,h2,h3,h4,p,li,span')) {
              if (![...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim()))
                continue
              const er = el.getBoundingClientRect()
              if (er.width === 0) continue
              n++
              if (
                er.top < pr.top - 2 ||
                er.bottom > pr.bottom + 2 ||
                er.left < pr.left - 2 ||
                er.right > pr.right + 2
              )
                c++
            }
          }
          return { c, n }
        })
        clipped += r.c
        checked += r.n
        await p.keyboard.press('ArrowRight')
        await p.waitForTimeout(1000)
      }
      log(
        'reader',
        `${w}x${h}`,
        `${slug}: text spilling off its page`,
        `${clipped}/${checked}`,
        clipped === 0
      )
      await p.close()
    }
  }

  // 1. Reader cover centring and open-spread centring (desktop)
  for (const [w, h] of [
    [1024, 768],
    [1280, 720],
    [1440, 900],
    [1920, 1080],
  ]) {
    const p = await b.newPage({ viewport: { width: w, height: h } })
    await p.goto(BASE + '/book/demo', { waitUntil: 'networkidle' })
    await p.waitForTimeout(1500)
    const centre = async () =>
      p.evaluate(() => {
        const vis = [...document.querySelectorAll('.stf__item')].filter((e) => {
          const r = e.getBoundingClientRect()
          return (
            r.width > 10 &&
            getComputedStyle(e).display !== 'none' &&
            r.right > 0 &&
            r.left < innerWidth
          )
        })
        const l = Math.min(...vis.map((e) => e.getBoundingClientRect().left)),
          r = Math.max(...vis.map((e) => e.getBoundingClientRect().right))
        return Math.round((l + r) / 2 - innerWidth / 2)
      })
    const c0 = await centre()
    log('reader', `${w}x${h}`, 'cover offset from centre (px)', c0, Math.abs(c0) <= 12)
    await p.keyboard.press('ArrowRight')
    await p.waitForTimeout(1500)
    const c1 = await centre()
    log('reader', `${w}x${h}`, 'open spread offset from centre (px)', c1, Math.abs(c1) <= 12)
    await p.close()
  }

  // 2. Editor: page inside its frame, toolbar labels on one line, header fits
  const ctxFor = async (w, h, m) => {
    const c = await b.newContext({
      viewport: { width: w, height: h },
      isMobile: !!m,
      hasTouch: !!m,
    })
    await c.addCookies([{ name: cname, value: crest.join('='), domain: 'localhost', path: '/' }])
    return c
  }
  for (const [w, h, m] of [
    [320, 568, 1],
    [375, 667, 1],
    [390, 844, 1],
    [430, 932, 1],
    [1024, 768],
    [1280, 800],
    [1440, 900],
  ]) {
    const ctx = await ctxFor(w, h, m)
    const p = await ctx.newPage()
    const errs = []
    p.on('pageerror', (e) => errs.push(String(e).slice(0, 100)))
    await p.goto(BASE + EDITOR, { waitUntil: 'networkidle' })
    await p.waitForTimeout(1500)
    const r = await p.evaluate(() => {
      const frame = [...document.querySelectorAll('div')].find((d) =>
        String(d.className).includes('justify-center-safe')
      )
      const page = frame?.querySelector('div[style*="width"]')
      const fr = frame?.getBoundingClientRect(),
        pr = page?.getBoundingClientRect()
      const toolbar = [...document.querySelectorAll('div')].find((d) =>
        String(d.className).includes('overflow-x-auto border-b')
      )
      const tbBtns = toolbar
        ? [...toolbar.querySelectorAll('button')].filter((x) => x.getClientRects().length)
        : []
      const wrapped = tbBtns
        .filter((x) => x.getBoundingClientRect().height > 36)
        .map((x) => x.innerText.trim())
      const tbOverflow = toolbar ? toolbar.scrollWidth - toolbar.clientWidth : 0
      const header = document.querySelector('header')
      const hb = header
        ? [...header.querySelectorAll('a,button')].filter((x) => x.getClientRects().length)
        : []
      const rightmost = Math.max(...hb.map((x) => x.getBoundingClientRect().right))
      const title = header
        ? [...header.querySelectorAll('button')].find((x) => x.className.includes('truncate'))
        : null
      const bars = [header, toolbar].filter(Boolean)
      const silent = bars.flatMap((bar) =>
        [...bar.querySelectorAll('button,a')]
          .filter(
            (x) =>
              x.getClientRects().length &&
              !x.innerText.trim() &&
              !x.title &&
              !(x.closest('[title]') && x.closest('[title]') !== bar)
          )
          .map((x) => x.getAttribute('aria-label') || x.outerHTML.slice(0, 60))
      )
      return {
        silent,
        pageW: Math.round(pr?.width),
        frameW: Math.round(fr?.width),
        inside: pr && fr ? pr.left >= fr.left - 1 && pr.right <= fr.right + 1 : null,
        wrapped,
        tbOverflow,
        headerOverflow: Math.round(rightmost - innerWidth),
        titleW: title ? Math.round(title.getBoundingClientRect().width) : null,
        docOverflow: document.documentElement.scrollWidth - innerWidth,
      }
    })
    log(
      'editor',
      `${w}x${h}`,
      'page fits frame (page/frame px)',
      `${r.pageW}/${r.frameW}`,
      r.inside === true
    )
    log(
      'editor',
      `${w}x${h}`,
      'toolbar buttons wrapped onto 2+ lines',
      r.wrapped.length ? JSON.stringify(r.wrapped) : 0,
      r.wrapped.length === 0
    )
    if (!m)
      log(
        'editor',
        `${w}x${h}`,
        'toolbar hidden past its edge (px)',
        r.tbOverflow,
        r.tbOverflow <= 0
      )
    log(
      'editor',
      `${w}x${h}`,
      'header past screen edge (px)',
      r.headerOverflow,
      r.headerOverflow <= 0
    )
    log('editor', `${w}x${h}`, 'title width (px)', r.titleW, r.titleW >= 60)
    log(
      'editor',
      `${w}x${h}`,
      'icon-only controls with no tooltip',
      r.silent.length ? JSON.stringify(r.silent.slice(0, 4)) : 0,
      r.silent.length === 0
    )
    log(
      'editor',
      `${w}x${h}`,
      'page scrolls sideways (px) / errors',
      `${r.docOverflow} / ${errs.length}`,
      r.docOverflow === 0 && errs.length === 0
    )
    await ctx.close()
  }

  // 3. Rendered text contrast across studio pages (laptop + phone)
  for (const [w, h, m] of [
    [1440, 900],
    [390, 844, 1],
  ]) {
    for (const route of ['/dashboard', EDITOR, '/account', '/insights']) {
      const ctx = await ctxFor(w, h, m)
      const p = await ctx.newPage()
      await p.goto(BASE + route, { waitUntil: 'networkidle' })
      await p.waitForTimeout(1200)
      const r = await p.evaluate(() => {
        // Any CSS colour (rgb, oklab, color-mix…) through the browser's own
        // conversion: Tailwind v4 emits translucent colours as oklab(), which a
        // regex for rgb() silently read as transparent.
        const cv = document.createElement('canvas')
        cv.width = cv.height = 1
        const cx = cv.getContext('2d', { willReadFrequently: true })
        const parse = (c) => {
          if (!c || c === 'transparent') return null
          cx.clearRect(0, 0, 1, 1)
          cx.fillStyle = '#000'
          cx.fillStyle = c
          cx.fillRect(0, 0, 1, 1)
          const [r, g, b, a] = cx.getImageData(0, 0, 1, 1).data
          return { r, g, b, a: a / 255 }
        }
        const lum = ({ r, g, b }) => {
          const f = (x) => {
            x /= 255
            return x <= 0.03928 ? x / 12.92 : ((x + 0.055) / 1.055) ** 2.4
          }
          return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b)
        }
        const bgOf = (el) => {
          let stack = []
          for (let e = el; e; e = e.parentElement) {
            const c = parse(getComputedStyle(e).backgroundColor)
            if (c && c.a > 0) {
              stack.push(c)
              if (c.a >= 1) break
            }
          }
          let base = { r: 255, g: 255, b: 255 }
          for (const c of stack.reverse())
            base = {
              r: c.r * c.a + base.r * (1 - c.a),
              g: c.g * c.a + base.g * (1 - c.a),
              b: c.b * c.a + base.b * (1 - c.a),
            }
          return base
        }
        let n = 0
        const low = []
        for (const el of document.querySelectorAll('body *')) {
          if (el.closest('[class*="bg-white"], .stf__item, [data-page-canvas]')) {
          } // keep
          if (![...el.childNodes].some((x) => x.nodeType === 3 && x.textContent.trim())) continue
          const s = getComputedStyle(el)
          if (s.visibility === 'hidden' || s.display === 'none' || parseFloat(s.opacity) < 0.5)
            continue
          const r = el.getBoundingClientRect()
          if (r.width <= 2 || r.height <= 2 || r.bottom < 0 || r.top > innerHeight) continue
          // Screen-reader-only text is clipped to 1px and never seen.
          if (s.position === 'absolute' && s.clip && s.clip !== 'auto' && s.clip.includes('rect(0'))
            continue
          // The author's own page content (the canvas and page thumbnails) is
          // their design, not studio UI.
          if (el.closest('[style*="scale("]') || el.closest('[class*="justify-center-safe"]'))
            continue
          if (el.closest('button:disabled, [aria-disabled="true"]')) continue
          const fg = parse(s.color)
          if (!fg) continue
          const bg = bgOf(el)
          const fgc = {
            r: fg.r * fg.a + bg.r * (1 - fg.a),
            g: fg.g * fg.a + bg.g * (1 - fg.a),
            b: fg.b * fg.a + bg.b * (1 - fg.a),
          }
          const [x, y] = [lum(fgc), lum(bg)].sort((a, b) => b - a)
          const ratio = (x + 0.05) / (y + 0.05)
          const size = parseFloat(s.fontSize),
            bold = parseInt(s.fontWeight) >= 700
          const need = size >= 24 || (size >= 18.66 && bold) ? 3 : 4.5
          n++
          if (ratio < need) low.push(`${ratio.toFixed(2)} "${el.textContent.trim().slice(0, 24)}"`)
        }
        return { n, low }
      })
      log(
        'contrast',
        `${w}x${h}`,
        `${route.split('/')[1] || 'home'} text below AA`,
        `${r.low.length}/${r.n}${r.low.length ? ' ' + JSON.stringify(r.low.slice(0, 4)) : ''}`,
        r.low.length === 0
      )
      await ctx.close()
    }
  }

  // 4. Home-page preview: nothing from the reader floats over the save card
  {
    const ctx = await b.newContext({
      viewport: { width: 390, height: 844 },
      isMobile: true,
      hasTouch: true,
    })
    const p = await ctx.newPage()
    await p.goto(BASE + '/', { waitUntil: 'networkidle' })
    await p.setInputFiles('input[type=file]', SAMPLE_PDF)
    await p.waitForTimeout(5000)
    const btn = p.locator('button', { hasText: 'Save this edition' })
    await btn.scrollIntoViewIfNeeded()
    await p.waitForTimeout(500)
    const r = await p.evaluate(() => {
      const card =
        [...document.querySelectorAll('button')]
          .find((x) => x.innerText.includes('Save this edition'))
          .closest('div.rounded-\\[1\\.5rem\\]') ||
        [...document.querySelectorAll('button')].find((x) =>
          x.innerText.includes('Save this edition')
        ).parentElement.parentElement
      const cr = card.getBoundingClientRect()
      let covered = 0,
        total = 0
      for (let x = cr.left + 8; x < cr.right - 8; x += 24)
        for (let y = cr.top + 8; y < cr.bottom - 8; y += 16) {
          total++
          const h = document.elementFromPoint(x, y)
          if (h && !card.contains(h)) covered++
        }
      const fixedReader = [...document.querySelectorAll('a,button,div')].filter(
        (e) =>
          getComputedStyle(e).position === 'fixed' &&
          /Report|riffle|Keyboard/i.test(e.innerText + (e.getAttribute('aria-label') || ''))
      ).length
      return { covered, total, fixedReader }
    })
    log(
      'preview',
      '390x844',
      'points on the save card covered by something else',
      `${r.covered}/${r.total}`,
      r.covered === 0
    )
    log(
      'preview',
      '390x844',
      'reader overlays fixed to the screen',
      r.fixedReader,
      r.fixedReader === 0
    )
    await ctx.close()
  }

  // 5. Pricing buttons reachable (regression)
  for (const [w, h] of [
    [320, 568],
    [375, 667],
    [390, 844],
  ]) {
    const ctx = await b.newContext({
      viewport: { width: w, height: h },
      isMobile: true,
      hasTouch: true,
    })
    const p = await ctx.newPage()
    await p.goto(BASE + '/', { waitUntil: 'networkidle' })
    let ok = 0
    for (const label of ['Start Free', 'Upgrade to Pro', 'Redeem or Get Lifetime']) {
      try {
        const a = p.locator('#pricing a', { hasText: label }).filter({ visible: true }).first()
        await a.scrollIntoViewIfNeeded({ timeout: 3000 })
        await a.click({ trial: true, timeout: 3000 })
        ok++
      } catch {}
    }
    log('pricing', `${w}x${h}`, 'plan buttons a thumb can reach', `${ok}/3`, ok === 3)
    await ctx.close()
  }

  await b.close()
  const fails = out.filter((o) => !o.ok)
  console.log(`\n${out.length - fails.length}/${out.length} checks pass`)
  process.exit(fails.length ? 1 : 0)
})()
