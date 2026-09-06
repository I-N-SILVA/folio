import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

/**
 * Every environment variable `/api/health` reports on is one the code reads.
 *
 * The health route exists so a launch is checked rather than believed, which
 * makes it the last place that should be wrong — and it was: it reported on
 * `GEMINI_API_KEY`, which appears nowhere in the app. `lib/ai.ts` reads
 * `GOOGLE_GENERATIVE_AI_API_KEY`. So a correctly configured deployment would
 * have shown a permanent warning for a variable that does not exist, and a
 * genuinely missing AI key would have gone unreported. A preflight that is
 * wrong about its own subject is worse than no preflight.
 *
 * The reverse direction is not asserted. Plenty of variables are read in places
 * that have nothing to do with whether the product can launch, and demanding a
 * health check for each would make this a chore rather than a guard.
 */

const HEALTH = join(process.cwd(), 'app', 'api', 'health', 'route.ts')
const ROOTS = ['app', 'lib', 'components', 'scripts']

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) walk(full, out)
    else if (/\.(ts|tsx|mjs)$/.test(full) && !full.includes('health/route.ts')) out.push(full)
  }
  return out
}

describe('the health check reports on variables that exist', () => {
  const reported = [...readFileSync(HEALTH, 'utf8').matchAll(/envCheck\('([A-Z0-9_]+)'/g)].map((m) => m[1])

  it('reports on a meaningful number of them', () => {
    // Guards the guard: a broken regex would make this suite pass vacuously.
    expect(reported.length).toBeGreaterThan(5)
  })

  it('names only variables the codebase actually reads', () => {
    const sources = ROOTS.flatMap((r) => walk(join(process.cwd(), r)))
      .map((f) => readFileSync(f, 'utf8'))
      .join('\n')

    const phantom = reported.filter((name) => !sources.includes(`process.env.${name}`))
    expect(
      phantom,
      `${phantom.join(', ')} is reported by /api/health and read nowhere — the preflight is wrong about its own subject`
    ).toEqual([])
  })

  it('covers the variables without which the product cannot launch', () => {
    // Not a style rule: each of these takes the whole thing down, and the point
    // of the route is that nobody has to remember them.
    for (const required of [
      'NEXT_PUBLIC_SUPABASE_URL',
      'NEXT_PUBLIC_SUPABASE_ANON_KEY',
      'SUPABASE_SERVICE_ROLE_KEY',
      'NEXT_PUBLIC_SITE_URL',
      'APPSUMO_API_KEY',
      'CRON_SECRET',
    ]) {
      expect(reported, `${required} is not checked before launch`).toContain(required)
    }
  })

  it('agrees with .env.example', () => {
    // `.env.example` is what an operator copies. A variable the health check
    // asks for that is not in there is one they will not know to set.
    const example = readFileSync(join(process.cwd(), '.env.example'), 'utf8')
    // An alias counts: the route reports the canonical name and accepts the
    // older one, and `.env.example` need only document one of them.
    const aliases: Record<string, string[]> = {
      SUPABASE_SERVICE_ROLE_KEY: ['SUPABASE_SERVICE_KEY'],
    }
    const missing = reported.filter(
      (name) => ![name, ...(aliases[name] ?? [])].some((n) => new RegExp(`^${n}=`, 'm').test(example))
    )
    expect(
      missing,
      `${missing.join(', ')} is checked at launch but absent from .env.example`
    ).toEqual([])
  })
})

describe('walk', () => {
  it('finds the source files it claims to', () => {
    const files = ROOTS.flatMap((r) => walk(join(process.cwd(), r)))
    expect(files.length).toBeGreaterThan(100)
    expect(files.some((f) => relative(process.cwd(), f) === join('lib', 'ai.ts'))).toBe(true)
  })
})
