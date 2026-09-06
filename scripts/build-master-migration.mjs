/**
 * Builds `supabase/master_migration.sql` from the numbered migrations.
 *
 * The consolidated file is what every launch document tells an operator to run
 * to "set up the entire production backend", and it was maintained by hand
 * alongside `supabase/migrations/*.sql`. Two sources of truth for one schema
 * drift, and this pair had: the checked-in master was missing 008, 009 and 012
 * entirely, so setting up production from it produced a database where
 *
 *   - `pages.layout` allowed four of the six layouts the editor offers, so two
 *     of them failed to save with "Could not save these pages";
 *   - `events.event_type` rejected `page_click` and `gate_unlock`, silently
 *     dropping every heatmap and lead-capture event;
 *   - slug history, the weekly digest, engagement insights, dunning grace and
 *     atomic page saves did not exist at all.
 *
 * Generating it removes the second source of truth. `supabase/master.test.ts`
 * fails if the checked-in file is not what this produces, so adding a migration
 * without regenerating cannot ship.
 *
 *   node scripts/build-master-migration.mjs          # write
 *   node scripts/build-master-migration.mjs --check  # verify only
 */

import { readFileSync, readdirSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

const DIR = join(process.cwd(), 'supabase', 'migrations')
const OUT = join(process.cwd(), 'supabase', 'master_migration.sql')

const HEADER = `-- ============================================================================
-- QLICO — CONSOLIDATED SUPABASE MIGRATION
--
-- GENERATED FILE. Do not edit by hand.
--   node scripts/build-master-migration.mjs
--
-- Every numbered migration in supabase/migrations, in order. Run it in the
-- Supabase SQL editor to bring a new or an existing project fully up to date:
-- each statement is idempotent, so running it twice is a no-op rather than an
-- error, and running it on a database that is several migrations behind
-- applies only what is missing.
--
-- This file used to be maintained by hand and fell three migrations behind,
-- which meant setting production up from it produced a database that silently
-- dropped analytics events and refused to save two of the six page layouts.
-- ============================================================================

`

export function buildMaster() {
  const files = readdirSync(DIR)
    .filter((f) => f.endsWith('.sql'))
    .sort()

  const parts = files.map((file) => {
    const sql = readFileSync(join(DIR, file), 'utf8').trimEnd()
    return [
      '-- ' + '-'.repeat(74),
      `-- ${file}`,
      '-- ' + '-'.repeat(74),
      '',
      sql,
      '',
    ].join('\n')
  })

  return HEADER + parts.join('\n') + '\n'
}

// Only when run as a program. The test imports `buildMaster` from here, and a
// module that writes the file on import makes a test comparing the two
// incapable of failing — which is what happened on the first run.
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const built = buildMaster()

  if (process.argv.includes('--check')) {
    if (readFileSync(OUT, 'utf8') !== built) {
      console.error('master_migration.sql is out of date — run: node scripts/build-master-migration.mjs')
      process.exit(1)
    }
    console.log('master_migration.sql is up to date.')
  } else {
    writeFileSync(OUT, built)
    console.log(`Wrote ${OUT}`)
  }
}
