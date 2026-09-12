/**
 * Responsive audit across real device viewports.
 *
 * Chrome's `--window-size` is clamped to a 500px minimum on macOS, so a
 * screenshot asked for at 375 is a 375px crop of a ~500px layout — which makes
 * a perfectly fine page look catastrophically broken. CDP's
 * `Emulation.setDeviceMetricsOverride` is not clamped, so this drives Chrome
 * over the DevTools protocol instead and gets a true viewport at any width.
 *
 *   node responsive-audit.mjs <baseUrl> [--shots <dir>]
 */
import { spawn } from 'node:child_process'
import { mkdirSync, writeFileSync } from 'node:fs'
import { setTimeout as sleep } from 'node:timers/promises'

const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT = 9333
const base = (process.argv[2] ?? 'http://localhost:3000').replace(/\/$/, '')
const shotDir = process.argv.includes('--shots')
  ? process.argv[process.argv.indexOf('--shots') + 1]
  : null
if (shotDir) mkdirSync(shotDir, { recursive: true })

const VIEWPORTS = [
  { name: 'iphone-se', w: 320, h: 568, mobile: true },
  { name: 'iphone-13-mini', w: 375, h: 812, mobile: true },
  { name: 'iphone-15', w: 390, h: 844, mobile: true },
  { name: 'iphone-15-pro-max', w: 430, h: 932, mobile: true },
  { name: 'ipad-mini', w: 768, h: 1024, mobile: true },
  { name: 'ipad-pro', w: 1024, h: 1366, mobile: false },
  { name: 'laptop', w: 1440, h: 900, mobile: false },
  { name: 'desktop', w: 1920, h: 1080, mobile: false },
]

const ROUTES = [
  { name: 'home', path: '/' },
  { name: 'gallery', path: '/gallery' },
  { name: 'login', path: '/login' },
  { name: 'help', path: '/help' },
  { name: 'press', path: '/press' },
  { name: 'pricing-anchor', path: '/#pricing' },
  { name: 'reader', path: '/book/demo-lookbook' },
  { name: 'embed', path: '/embed/demo' },
  { name: 'terms', path: '/terms' },
  { name: 'notfound', path: '/book/does-not-exist' },
]

const chrome = spawn(CHROME, [
  '--headless=new',
  '--disable-gpu',
  '--no-sandbox',
  '--hide-scrollbars',
  '--no-first-run',
  `--remote-debugging-port=${PORT}`,
  '--user-data-dir=/tmp/folio-audit-profile',
  'about:blank',
], { stdio: 'ignore' })

process.on('exit', () => chrome.kill())

async function wsUrl() {
  for (let i = 0; i < 40; i++) {
    try {
      const r = await fetch(`http://127.0.0.1:${PORT}/json/version`)
      const j = await r.json()
      if (j.webSocketDebuggerUrl) return j.webSocketDebuggerUrl
    } catch {}
    await sleep(250)
  }
  throw new Error('Chrome did not expose a debugging endpoint')
}

const ws = new WebSocket(await wsUrl())
await new Promise((res, rej) => {
  ws.addEventListener('open', res, { once: true })
  ws.addEventListener('error', rej, { once: true })
})

let nextId = 1
const pending = new Map()
ws.addEventListener('message', (ev) => {
  const msg = JSON.parse(ev.data)
  if (msg.id && pending.has(msg.id)) {
    const { resolve, reject } = pending.get(msg.id)
    pending.delete(msg.id)
    msg.error ? reject(new Error(JSON.stringify(msg.error))) : resolve(msg.result)
  }
})

function send(method, params = {}, sessionId) {
  const id = nextId++
  return new Promise((resolve, reject) => {
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params, sessionId }))
    setTimeout(() => {
      if (pending.has(id)) { pending.delete(id); reject(new Error(`${method} timed out`)) }
    }, 45000)
  })
}

// One tab, reused for every combination.
const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const S = (m, p) => send(m, p, sessionId)
await S('Page.enable')
await S('Runtime.enable')

/** Runs in the page. Returns the findings for one route at one viewport. */
const AUDIT = `(() => {
  const vw = window.innerWidth, out = [];
  const doc = document.documentElement;
  const add = (sev, kind, detail) => out.push({ sev, kind, detail });

  const overflow = doc.scrollWidth - doc.clientWidth;
  if (overflow > 1) {
    const who = [...document.querySelectorAll('*')].filter(e => {
      const r = e.getBoundingClientRect();
      const cs = getComputedStyle(e);
      return r.width > 0 && r.right > vw + 1 && cs.position !== 'fixed' && cs.visibility !== 'hidden';
    }).slice(0, 4).map(e => ({
      tag: e.tagName.toLowerCase(),
      cls: (e.className || '').toString().slice(0, 55),
      right: Math.round(e.getBoundingClientRect().right),
    }));
    add('HIGH', 'horizontal-overflow', { by: overflow, culprits: who });
  }

  const text = document.body.innerText.trim().length;
  if (text < 40) add('HIGH', 'no-content', { chars: text });

  // Hit-test rather than measure. A control can carry a transparent
  // pseudo-element that enlarges its touch area without changing its box, so
  // getBoundingClientRect understates it. What matters is whether a thumb
  // landing 22px off-centre still reaches the control, so ask the document.
  const reachable = (el, dx, dy) => {
    const r = el.getBoundingClientRect();
    const x = r.left + r.width / 2 + dx, y = r.top + r.height / 2 + dy;
    if (x < 0 || y < 0 || x > innerWidth || y > innerHeight) return true; // off-screen, not judgeable
    const hit = document.elementFromPoint(x, y);
    return !!hit && (hit === el || el.contains(hit) || hit.contains(el));
  };

  const small = [...document.querySelectorAll('a,button,[role=button],input,select,textarea')]
    .filter(e => {
      const r = e.getBoundingClientRect();
      if (!r.width || !r.height) return false;
      const cs = getComputedStyle(e);
      if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') return false;
      // A visually-hidden control is a label for something else, not a target.
      if (e.classList.contains('sr-only')) return false;
      // Inline links inside a paragraph are prose, not tap targets.
      if (e.tagName === 'A' && cs.display === 'inline') return false;
      if (r.height >= 44 && r.width >= 44) return false;
      // Small box, but is a 44px-wide reach still on target?
      return !(reachable(e, -20, 0) && reachable(e, 20, 0) && reachable(e, 0, -20) && reachable(e, 0, 20));
    })
    .slice(0, 8)
    .map(e => ({
      t: (e.innerText || e.getAttribute('aria-label') || '?').trim().slice(0, 24),
      w: Math.round(e.getBoundingClientRect().width),
      h: Math.round(e.getBoundingClientRect().height),
    }));
  if (small.length) add('MED', 'tap-target-unreachable', { count: small.length, ex: small });

  const wideImg = [...document.images].filter(i => i.getBoundingClientRect().width > vw + 1).length;
  if (wideImg) add('MED', 'image-wider-than-viewport', { count: wideImg });

  // The reader's orientation, where it exists.
  const wrap = document.querySelector('.stf__wrapper');
  const flip = wrap ? (/--portrait/.test(wrap.className) ? 'portrait' : 'landscape') : null;

  return JSON.stringify({ vw, chars: text, flip, findings: out });
})()`

async function audit(url, vp) {
  await S('Emulation.setDeviceMetricsOverride', {
    width: vp.w, height: vp.h, deviceScaleFactor: 1, mobile: vp.mobile,
  })
  await S('Page.navigate', { url })
  // Give the client time to hydrate and any Suspense boundary to resolve.
  await sleep(2600)
  const { result } = await S('Runtime.evaluate', {
    expression: AUDIT, returnByValue: true, awaitPromise: false,
  })
  return JSON.parse(result.value)
}

const problems = []
for (const route of ROUTES) {
  const line = []
  for (const vp of VIEWPORTS) {
    let r
    try {
      r = await audit(base + route.path, vp)
    } catch (e) {
      line.push(`${vp.name}:ERR`)
      problems.push({ route: route.name, vp: vp.name, findings: [{ sev: 'HIGH', kind: 'audit-failed', detail: String(e).slice(0, 90) }] })
      continue
    }
    const bad = r.findings.filter((f) => f.sev === 'HIGH').length
    const med = r.findings.filter((f) => f.sev === 'MED').length
    line.push(`${vp.name}:${bad ? 'X' + bad : med ? 'm' + med : 'ok'}${r.flip ? '/' + r.flip[0] : ''}`)
    if (r.findings.length) problems.push({ route: route.name, vp: vp.name, vw: r.vw, findings: r.findings })

    if (shotDir && (vp.name === 'iphone-13-mini' || vp.name === 'ipad-mini')) {
      const shot = await S('Page.captureScreenshot', { format: 'png' })
      writeFileSync(`${shotDir}/${route.name}-${vp.name}.png`, Buffer.from(shot.data, 'base64'))
    }
  }
  console.log(`  ${route.name.padEnd(15)} ${line.join('  ')}`)
}

console.log('\n── findings ──')
if (!problems.length) console.log('  none')
for (const p of problems) {
  for (const f of p.findings) {
    console.log(`  [${f.sev}] ${p.route} @ ${p.vp} (${p.vw ?? '?'}px) ${f.kind}`)
    console.log(`        ${JSON.stringify(f.detail).slice(0, 260)}`)
  }
}
ws.close()
chrome.kill()
process.exit(0)
