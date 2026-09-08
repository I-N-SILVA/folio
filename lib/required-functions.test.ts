import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { REQUIRED_FUNCTIONS } from './required-functions'

const ROOT = join(__dirname, '..')

function walk(dir: string): string[] {
  const full = join(ROOT, dir)
  if (!statSync(full, { throwIfNoEntry: false })?.isDirectory()) return []
  return readdirSync(full, { withFileTypes: true }).flatMap((e) => {
    const child = join(dir, e.name)
    if (e.isDirectory()) return walk(child)
    return /\.tsx?$/.test(e.name) && !/\.test\.tsx?$/.test(e.name) ? [child] : []
  })
}

/** Every `.rpc('name'` in shipped code, with the file it was found in. */
function calledFunctions(): Map<string, string[]> {
  const found = new Map<string, string[]>()
  for (const file of [...walk('app'), ...walk('lib'), ...walk('components')]) {
    const src = readFileSync(join(ROOT, file), 'utf8')
    // Anchored on the call, not on the name: a bare grep for a function name
    // matches the comments that explain it, which is the trap
    // `supabase/master-migration.test.ts` documents.
    for (const [, name] of src.matchAll(/\.rpc\(\s*'([a-z0-9_]+)'/g)) {
      found.set(name, [...(found.get(name) ?? []), relative(ROOT, join(ROOT, file))])
    }
  }
  return found
}

describe('the health check knows every function the app calls', () => {
  const called = calledFunctions()
  const listed = new Set(REQUIRED_FUNCTIONS.map((f) => f.name))

  it('finds the calls at all', () => {
    // If this drops to nothing the regex has rotted and every other assertion
    // below passes vacuously.
    expect(called.size).toBeGreaterThanOrEqual(6)
  })

  it.each([...called.keys()].sort())('%s is in REQUIRED_FUNCTIONS', (name) => {
    expect(
      listed.has(name),
      `${name}() is called in ${called.get(name)!.join(', ')} but /api/health would not notice it missing`
    ).toBe(true)
  })

  it('does not list functions nothing calls', () => {
    // A stale entry makes the health check fail a deployment over something
    // that no longer matters, which trains people to ignore it.
    const orphans = REQUIRED_FUNCTIONS.map((f) => f.name).filter((n) => !called.has(n))
    expect(orphans, 'listed but never called').toEqual([])
  })

  it('every entry names the migration that adds it', () => {
    const master = readFileSync(join(ROOT, 'supabase', 'master_migration.sql'), 'utf8')
    for (const fn of REQUIRED_FUNCTIONS) {
      expect(fn.migration).toMatch(/^\d{3}$/)
      expect(fn.cost.length, `${fn.name} needs a cost`).toBeGreaterThan(10)
      // And the function actually exists in the consolidated migration, so the
      // health check cannot demand something no migration provides.
      expect(
        master.includes(`FUNCTION public.${fn.name}(`),
        `${fn.name} is required but master_migration.sql does not define it`
      ).toBe(true)
    }
  })

  it('marks the money path critical', () => {
    // These two are the difference between "a feature is missing" and "a buyer
    // paid and cannot redeem" / "an autosave can lose pages".
    for (const name of ['claim_appsumo_license', 'replace_book_pages']) {
      expect(REQUIRED_FUNCTIONS.find((f) => f.name === name)?.critical).toBe(true)
    }
  })

  it('is actually consulted by the health route', () => {
    const route = readFileSync(join(ROOT, 'app', 'api', 'health', 'route.ts'), 'utf8')
    expect(route).toContain('REQUIRED_FUNCTIONS')
    expect(route).toContain("rpc('installed_functions')")
    expect(route).toContain('functionChecks()')
  })
})
