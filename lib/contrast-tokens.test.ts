import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
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
