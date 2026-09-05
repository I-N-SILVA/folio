import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PageSchema, EVENT_TYPES } from './book-schema'

/**
 * The app's enums against the database's CHECK constraints.
 *
 * This project has now shipped the same bug twice. Migration 008 exists because
 * `events.event_type` allowed eleven values while the client had always sent
 * thirteen, so every `page_click` and `gate_unlock` was silently rejected.
 * Migration 012 exists because `pages.layout` allowed four while the editor's
 * dropdown offered five — an author who chose "Grid" got "Could not save these
 * pages" and no way to work out why.
 *
 * Both were invisible to typecheck, lint and every other test, because the
 * mismatch only exists between a TypeScript file and a `.sql` file that nothing
 * reads. This test reads it.
 *
 * It parses the migrations in order and takes the last constraint defined for a
 * column, which is what Postgres would have after they all run. Adding a value
 * to a Zod enum without a migration now fails here.
 */

const MIGRATIONS = join(process.cwd(), 'supabase', 'migrations')

/** Every value in the last CHECK constraint defined for `column`, in file order. */
function constraintValues(column: string): string[] {
  const files = readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  let latest: string[] | null = null

  for (const file of files) {
    const sql = readFileSync(join(MIGRATIONS, file), 'utf8')
    // Anchored on CHECK, which matches both the inline form in a CREATE TABLE
    // and a later ADD CONSTRAINT — and, importantly, does not match a query's
    // `WHERE event_type IN (...)`. Migration 009 has one of those on line 167,
    // and without the anchor it silently became "the constraint".
    const pattern = new RegExp(`CHECK\\s*\\(\\s*(?<![_a-z])${column}\\s+IN\\s*\\(([^)]*)\\)`, 'gi')
    for (const match of sql.matchAll(pattern)) {
      latest = match[1]
        .split(',')
        .map((v) => v.trim().replace(/^'|'$/g, ''))
        .filter(Boolean)
    }
  }

  if (!latest) throw new Error(`No CHECK constraint found for "${column}" in any migration`)
  return latest
}

describe('the app enums and the database CHECK constraints', () => {
  it('accepts every page layout the editor can produce', () => {
    const allowed = constraintValues('layout')
    const app = PageSchema.shape.layout.options
    const missing = app.filter((v) => !allowed.includes(v))
    expect(
      missing,
      `pages.layout CHECK is missing ${missing.join(', ')} — add a migration, or these fail to save`
    ).toEqual([])
  })

  it('accepts every page type the app can produce', () => {
    const allowed = constraintValues('type')
    const app = PageSchema.shape.type.options
    expect(app.filter((v) => !allowed.includes(v))).toEqual([])
  })

  it('accepts every event type the client can send', () => {
    const allowed = constraintValues('event_type')
    const app: readonly string[] = EVENT_TYPES
    const missing = app.filter((v) => !allowed.includes(v))
    expect(
      missing,
      `events.event_type CHECK is missing ${missing.join(', ')} — every one of those is dropped`
    ).toEqual([])
  })

  it('reads the last constraint defined, not the first', () => {
    // 002 creates pages.layout with four values and 010 replaces it with six;
    // a parser that stopped at the first match would report this as passing
    // while production rejected two of them.
    expect(constraintValues('layout')).toContain('canvas')
    expect(constraintValues('layout').length).toBeGreaterThan(4)
  })
})
