import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { contrastRatio } from './contrast'
import { join, relative } from 'node:path'

/**
 * A background token paired with a hardcoded text colour.
 *
 * This app's palette inverts: `--accent`, `--qlico-teal`, `--accent-vivid` and
 * `--qlico-ink` are all `#000` in light and `#fff` in dark. That is correct, and
 * it is why they come in pairs — `--accent` with `--accent-contrast`. Put one of
 * them behind a *fixed* colour like `text-white` and the result is legible in
 * exactly one theme.
 *
 * It has happened twice. Once in the editor, where a single token made six
 * controls invisible (HANDOVER §2). Then again on four buttons at the centre of
 * the funnel — "Create edition", "Upgrade", "Start from this", and the AppSumo
 * "Redeem code" button — every one of them white text on a white pill for any
 * buyer whose system was set to dark.
 *
 * Nothing catches it: the class names are right, the tokens exist, typecheck and
 * lint are silent, and whoever wrote it was looking at a light screen.
 */

const ROOTS = ['app', 'components']

/** Background tokens whose value inverts between light and dark. */
const FLIPPING = ['--accent', '--accent-vivid', '--qlico-teal', '--qlico-ink', '--invert-surface']

/** Text colours that do not. */
const FIXED = /\btext-(white|black|neutral-\d{3}|zinc-\d{3}|slate-\d{3}|gray-\d{3})\b/

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.tsx$/.test(full)) out.push(full)
  }
  return out
}

/**
 * Class strings containing one of the flipping tokens as a background.
 *
 * Scoped to a single quoted class value so a `text-white` several elements away
 * in the same file is not reported — the pairing only matters within one
 * `className`.
 */
function offendingClassStrings(source: string): string[] {
  const found: string[] = []
  for (const match of source.matchAll(/(?:className|class)\s*=\s*[{]?[`'"]([^`'"]{0,900})[`'"]/g)) {
    const cls = match[1]
    const bg = FLIPPING.find((t) => cls.includes(`bg-[var(${t})]`))
    if (!bg) continue
    const fixed = cls.match(FIXED)
    if (fixed) found.push(`bg-[var(${bg})] with ${fixed[0]}`)
  }
  // A ternary picking between two class strings is covered too: each branch is
  // its own quoted string and matched separately by the loop above.
  return found
}

describe('a flipping background token is never paired with a fixed text colour', () => {
  const files = ROOTS.flatMap((r) => walk(join(process.cwd(), r)))

  it('scans a meaningful number of files', () => {
    // Guards the guard: a broken walk would make this suite pass by finding
    // nothing, which is exactly the failure mode it exists to prevent.
    expect(files.length).toBeGreaterThan(50)
  })

  it('finds no unreadable pairing', () => {
    const offenders: string[] = []
    for (const file of files) {
      for (const problem of offendingClassStrings(readFileSync(file, 'utf8'))) {
        offenders.push(`${relative(process.cwd(), file)}: ${problem}`)
      }
    }
    expect(
      offenders,
      `these are legible in one theme only — pair the token with its contrast (e.g. --accent with --accent-contrast):\n  ${offenders.join('\n  ')}`
    ).toEqual([])
  })
})

describe('the detector', () => {
  it('catches the exact shape that shipped', () => {
    // The "Create edition" button, as it was.
    const sample = `className="rounded-full bg-[var(--qlico-teal)] px-4 py-3 text-white shadow-lg"`
    expect(offendingClassStrings(sample)).toHaveLength(1)
  })

  it('accepts a correct pairing', () => {
    const sample = `className="rounded-full bg-[var(--accent)] px-4 py-3 text-[var(--accent-contrast)]"`
    expect(offendingClassStrings(sample)).toEqual([])
  })

  it('does not flag a fixed text colour on a non-flipping background', () => {
    const sample = `className="bg-red-500 text-white"`
    expect(offendingClassStrings(sample)).toEqual([])
  })

  it('does not flag a fixed text colour elsewhere in the same file', () => {
    const sample = `
      <div className="bg-[var(--accent)] text-[var(--accent-contrast)]" />
      <p className="text-white" />
    `
    expect(offendingClassStrings(sample)).toEqual([])
  })
})

/**
 * A token that is written into every theme block and holds the same value in
 * all of them.
 *
 * `--qlico-muted` and `--invert-muted` were both `#888888` in the light block,
 * the `[data-theme='dark']` block and the `prefers-color-scheme` block. Present
 * in each, so the palette read as theme-aware; identical in each, so it was
 * not. A mid grey only clears AA on the dark side of a pairing — 3.11:1 against
 * `--qlico-subtle` in light — which put every muted caption in the app's
 * *default* theme below AA, with `--invert-muted` failing the same way mirrored
 * onto white.
 *
 * `npm run audit:theme` finds this in a browser. This finds it in a second.
 */

const CSS = readFileSync(join(__dirname, '..', 'app', 'globals.css'), 'utf8')

/** The declarations inside one balanced `{ … }` starting at `from`. */
function blockAt(from: number): string {
  const open = CSS.indexOf('{', from)
  let depth = 0
  for (let i = open; i < CSS.length; i++) {
    if (CSS[i] === '{') depth++
    else if (CSS[i] === '}' && --depth === 0) return CSS.slice(open + 1, i)
  }
  throw new Error('unbalanced block')
}

function tokensOf(selector: string): Record<string, string> {
  const at = CSS.indexOf(selector)
  expect(at, `${selector} should exist in globals.css`).toBeGreaterThan(-1)
  const out: Record<string, string> = {}
  for (const [, name, value] of blockAt(at).matchAll(/(--[a-z0-9-]+)\s*:\s*([^;]+);/g)) {
    out[name] = value.trim()
  }
  return out
}

const THEMES = {
  light: ':root {',
  'dark (explicit)': ":root[data-theme='dark'] {",
  'dark (system)': ":root:not([data-theme='light']) {",
}

/** Text tokens, and the surfaces each is actually painted on. */
const PAIRINGS: { text: string; grounds: string[] }[] = [
  {
    text: '--qlico-muted',
    grounds: [
      '--background',
      '--background-alt',
      '--qlico-paper',
      '--qlico-vellum',
      '--qlico-subtle',
    ],
  },
  // The inverted surface is the dark card on a light page and vice versa, so
  // its muted text has to be measured against it rather than against the page.
  { text: '--invert-muted', grounds: ['--invert-surface'] },
  { text: '--invert-text', grounds: ['--invert-surface'] },
  { text: '--qlico-ink', grounds: ['--qlico-paper', '--background'] },
  { text: '--accent-contrast', grounds: ['--accent', '--btn-solid'] },
]

describe('muted text clears AA on every surface it lands on', () => {
  for (const [themeName, selector] of Object.entries(THEMES)) {
    const tokens = tokensOf(selector)
    for (const { text, grounds } of PAIRINGS) {
      for (const ground of grounds) {
        const fg = tokens[text]
        const bg = tokens[ground]
        if (!fg || !bg || !fg.startsWith('#') || !bg.startsWith('#')) continue
        it(`${themeName}: ${text} on ${ground}`, () => {
          expect(contrastRatio(fg, bg), `${fg} on ${bg}`).toBeGreaterThanOrEqual(4.5)
        })
      }
    }
  }

  it('does not give a theme-varying token the same value in every block', () => {
    // The failure was not a missing declaration — it was three identical ones.
    for (const name of ['--qlico-muted', '--invert-muted']) {
      const values = Object.values(THEMES).map((sel) => tokensOf(sel)[name])
      expect(new Set(values).size, `${name} is ${values.join(' / ')}`).toBeGreaterThan(1)
    }
  })
})

describe('the studio is a dark room, so its greys have to be light enough', () => {
  /**
   * `text-neutral-500` is `rgb(115,115,115)`, which on the studio's own grounds
   * — `bg-neutral-950` (#0a0a0a) through `bg-neutral-800` (#262626) — measures
   * 4.18:1 at best. Every label wearing it was under AA.
   *
   * This is the whole of `docs/editor-redesign-spec.md` §9.1 that was worth
   * doing. The item asks for a sweep of ~540 hardcoded `neutral-*` classes;
   * `npm run audit:theme` says the studio is a deliberate dark surface where
   * those classes are the design, and that exactly one of them was illegible.
   * One class, replaced everywhere, with a number behind it.
   */
  const STUDIO = ['components/studio', 'app/(studio)']

  function walk(dir: string): string[] {
    const full = join(__dirname, '..', dir)
    if (!statSync(full, { throwIfNoEntry: false })?.isDirectory()) return []
    return readdirSync(full, { withFileTypes: true }).flatMap((e) =>
      e.isDirectory() ? walk(join(dir, e.name)) : e.name.endsWith('.tsx') ? [join(dir, e.name)] : []
    )
  }

  const files = STUDIO.flatMap(walk)

  it('has studio files to check', () => {
    expect(files.length).toBeGreaterThan(10)
  })

  it.each(files)('%s does not use text-neutral-500', (file) => {
    const src = readFileSync(join(__dirname, '..', file), 'utf8')
    expect(src).not.toMatch(/\btext-neutral-500\b/)
  })
})
