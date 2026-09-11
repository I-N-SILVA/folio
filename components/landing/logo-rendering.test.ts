import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * No `next/image` may point at an SVG without `unoptimized`.
 *
 * `next/image` routes even a local `/public` file through `/_next/image`, which
 * answers **400 "url parameter is valid but image type is not allowed"** for
 * SVG unless `images.dangerouslyAllowSVG` is set. So every one of these renders
 * nothing at all, in every environment.
 *
 * Six of them shipped at once: the landing nav, both lockups on the login page
 * a buyer lands on straight after "Get started", both press-kit specimens, and
 * the dashboard header every signed-in author sees. Nothing caught it because a
 * missing logo throws no error and breaks no test.
 *
 * `dangerouslyAllowSVG` is deliberately NOT the fix: `*.supabase.co` is in
 * `remotePatterns` and authors upload images there, so allowing SVG through the
 * optimiser would serve a user-supplied SVG, scripts and all. Inline it
 * (`Mark` / `MarkSymbol`) or pass `unoptimized` when the file itself is the
 * point, as on the press page.
 */

const ROOT = join(__dirname, '..', '..')

function walk(dir: string): string[] {
  const full = join(ROOT, dir)
  if (!statSync(full, { throwIfNoEntry: false })?.isDirectory()) return []
  return readdirSync(full, { withFileTypes: true }).flatMap((e) => {
    const child = join(dir, e.name)
    if (e.isDirectory()) return walk(child)
    return /\.tsx$/.test(e.name) ? [child] : []
  })
}

const files = [...walk('app'), ...walk('components')]

/**
 * Block comments are stripped first: this very file's neighbours explain the
 * bug by quoting `<Image src="…svg">` in prose, and a scanner that cannot tell
 * documentation from code reports the documentation.
 *
 * `//` comments are left alone on purpose, since stripping them would eat the
 * `//` in every `https://` src.
 */
function stripBlockComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '')
}

/** Each `<Image ... />` element in a file, as raw text. */
function imageElements(raw: string): string[] {
  const source = stripBlockComments(raw)
  const out: string[] = []
  const re = /<Image\b/g
  let m: RegExpExecArray | null
  while ((m = re.exec(source))) {
    const end = source.indexOf('>', m.index)
    if (end !== -1) out.push(source.slice(m.index, end + 1))
  }
  return out
}

describe('no next/image points at an SVG without unoptimized', () => {
  it('scanned a believable number of files', () => {
    // If this collapses the walk has rotted and the assertion below is vacuous.
    expect(files.length).toBeGreaterThan(20)
  })

  const offenders: { file: string; el: string }[] = []
  for (const file of files) {
    const source = readFileSync(join(ROOT, file), 'utf8')
    for (const el of imageElements(source)) {
      if (!/src\s*=\s*["'][^"']*\.svg["']/.test(el)) continue
      if (/\bunoptimized\b/.test(el)) continue
      offenders.push({ file: relative(ROOT, join(ROOT, file)), el: el.replace(/\s+/g, ' ').slice(0, 90) })
    }
  }

  it('finds none', () => {
    expect(
      offenders,
      offenders.length
        ? `These render nothing — /_next/image returns 400 for SVG.\n` +
          offenders.map((o) => `  ${o.file}\n    ${o.el}`).join('\n') +
          `\nInline it with Mark/MarkSymbol, or add \`unoptimized\`.`
        : undefined
    ).toEqual([])
  })
})

describe('the optimiser stays closed to SVG', () => {
  it('dangerouslyAllowSVG is not enabled', () => {
    // Authors upload images to Supabase and *.supabase.co is an allowed remote
    // pattern, so turning this on would serve user-supplied SVG through the
    // image optimiser. If it is ever needed, it needs a CSP and
    // contentDispositionType: 'attachment' alongside it.
    const config = readFileSync(join(ROOT, 'next.config.ts'), 'utf8')
    expect(config).not.toMatch(/dangerouslyAllowSVG\s*:\s*true/)
  })
})
