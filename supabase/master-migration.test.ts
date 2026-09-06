import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync } from 'node:fs'
import { join } from 'node:path'
import { buildMaster } from '../scripts/build-master-migration.mjs'

/**
 * The consolidated migration against the numbered ones.
 *
 * `supabase/master_migration.sql` is what every launch document tells an
 * operator to run to set production up. It was maintained by hand next to
 * `supabase/migrations/*.sql`, which is two sources of truth for one schema,
 * and it had drifted three migrations behind. A database built from it:
 *
 *   - refused two of the six page layouts the editor offers, surfacing as
 *     "Could not save these pages" with nothing pointing at the layout;
 *   - silently dropped every `page_click` and `gate_unlock` event, which is
 *     the heatmap and the lead capture;
 *   - had no slug history, weekly digest, engagement view, dunning grace or
 *     atomic page save at all.
 *
 * None of that is visible until production is already running on it.
 */

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')
const MASTER = join(process.cwd(), 'supabase', 'master_migration.sql')

describe('the consolidated migration', () => {
  it('is exactly what the generator produces', () => {
    const current = readFileSync(MASTER, 'utf8')
    expect(
      current === buildMaster(),
      'supabase/master_migration.sql is stale — run: node scripts/build-master-migration.mjs'
    ).toBe(true)
  })

  it('contains every numbered migration', () => {
    const master = readFileSync(MASTER, 'utf8')
    const files = readdirSync(MIGRATIONS).filter((f) => f.endsWith('.sql'))
    const missing = files.filter((f) => !master.includes(f))
    expect(missing, `${missing.join(', ')} is not in the consolidated migration`).toEqual([])
  })

  it('applies them in numeric order, because later ones correct earlier ones', () => {
    // 002 creates pages.layout with four values and 012 replaces it with six.
    // Concatenated the other way round, a fresh database ends up with the
    // broken constraint and no error to say so.
    const master = readFileSync(MASTER, 'utf8')
    const files = readdirSync(MIGRATIONS)
      .filter((f) => f.endsWith('.sql'))
      .sort()
    const positions = files.map((f) => master.indexOf(f))
    expect(positions.every((p) => p >= 0)).toBe(true)
    expect([...positions].sort((a, b) => a - b)).toEqual(positions)
  })

  it('is safe to run twice', () => {
    // An operator runs this against a project that is already partly set up —
    // that is the normal case, not the exception. Anything that would throw
    // "already exists" the second time makes the file unusable for its
    // documented purpose.
    const master = readFileSync(MASTER, 'utf8')
    const withoutComments = master.replace(/--[^\n]*/g, '')

    const unguarded: string[] = []
    for (const stmt of withoutComments.split(';')) {
      const s = stmt.replace(/\s+/g, ' ').trim()
      if (!s) continue
      if (/^CREATE (TABLE|INDEX)\b/i.test(s) && !/IF NOT EXISTS/i.test(s)) unguarded.push(s.slice(0, 70))
      if (/^CREATE (FUNCTION|VIEW)\b/i.test(s) && !/OR REPLACE/i.test(s)) unguarded.push(s.slice(0, 70))
    }
    expect(unguarded, `not re-runnable: ${unguarded.join(' | ')}`).toEqual([])
  })

  it('drops a trigger or policy before creating it', () => {
    // `CREATE TRIGGER` and `CREATE POLICY` have no IF NOT EXISTS form, so the
    // only way to make them re-runnable is an explicit drop first.
    const master = readFileSync(MASTER, 'utf8').replace(/--[^\n]*/g, '')

    for (const [kind, re] of [
      ['TRIGGER', /CREATE TRIGGER (\w+)[\s\S]{0,120}?ON ((?:public|auth)\.\w+)/g],
      ['POLICY', /CREATE POLICY ("[^"]+") ON (public\.\w+)/g],
    ] as const) {
      for (const m of master.matchAll(re)) {
        const drop = `DROP ${kind} IF EXISTS ${m[1]} ON ${m[2]};`
        expect(master.includes(drop), `${drop} is missing before its CREATE`).toBe(true)
      }
    }
  })

  it('ends with the layout and event constraints the app actually needs', () => {
    // The two that were wrong. Asserted on the consolidated file specifically,
    // because schema-db-drift.test.ts reads the numbered migrations and would
    // not have caught the master falling behind them.
    const master = readFileSync(MASTER, 'utf8')
    // Anchored on CHECK for both, so a `WHERE ... IN (...)` in a query cannot
    // be mistaken for the constraint — see the note below.
    const layouts = [...master.matchAll(/CHECK \(\s*layout IN \(([^)]*)\)/g)]
    expect(layouts.length, 'no layout CHECK in the consolidated migration').toBeGreaterThan(0)
    const finalLayout = layouts[layouts.length - 1][1]
    expect(finalLayout).toContain('canvas')
    expect(finalLayout).toContain('grid')

    // Anchored on CHECK. `lastIndexOf('event_type IN')` finds the `WHERE
    // event_type IN (...)` inside the engagement aggregate instead — the same
    // trap schema-db-drift.test.ts documents, which this test walked into on
    // its first run.
    const events = [...master.matchAll(/CHECK \(\s*event_type IN \(([^)]*)\)/g)]
    expect(events.length, 'no event_type CHECK in the consolidated migration').toBeGreaterThan(0)
    const finalEvents = events[events.length - 1][1]
    for (const type of ['page_click', 'gate_unlock', 'gate_view']) {
      expect(finalEvents, `${type} is not in the final event_type constraint`).toContain(type)
    }
  })
})
