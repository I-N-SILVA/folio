/**
 * Every database function this app calls, and what its absence costs.
 *
 * A deployment running an older `master_migration.sql` has the tables and fails
 * at the functions, which is the quietest way for this codebase to break: two
 * of the entries below are the launch-stopping bugs this branch opened with,
 * and every other health check reports green while they are missing.
 *
 * `lib/required-functions.test.ts` greps the app for `.rpc('…')` and fails if
 * anything called is not listed here, so a new function cannot be added without
 * the health check learning about it.
 */
export type RequiredFunction = {
  name: string
  /** Migration that adds it, for the "apply this" line in the health output. */
  migration: string
  /** True when the app is broken without it rather than merely diminished. */
  critical: boolean
  /** What a user experiences when it is not there. */
  cost: string
}

export const REQUIRED_FUNCTIONS: readonly RequiredFunction[] = [
  {
    name: 'claim_appsumo_license',
    migration: '015',
    critical: true,
    cost: 'every AppSumo redemption answers “We could not find that license code”',
  },
  {
    name: 'replace_book_pages',
    migration: '009',
    critical: true,
    cost: 'saving pages falls back to a non-atomic delete-then-insert',
  },
  {
    name: 'claim_digest_slot',
    migration: '016',
    critical: true,
    cost: 'the weekly digest skips every profile and sends nothing',
  },
  {
    name: 'edition_engagement',
    migration: '009',
    critical: true,
    cost: 'Insights cannot report readers or leads',
  },
  {
    name: 'constraint_allowed_values',
    migration: '014',
    critical: false,
    cost: 'this health check cannot verify the live CHECK constraints',
  },
  {
    name: 'installed_functions',
    migration: '020',
    critical: false,
    cost: 'this health check cannot verify anything else in this list',
  },
  {
    name: 'snapshot_book_version',
    migration: '018',
    critical: false,
    cost: 'version history records nothing',
  },
  {
    name: 'restore_book_version',
    migration: '018',
    critical: false,
    cost: 'a version cannot be restored',
  },
  {
    name: 'review_link_book',
    migration: '019',
    critical: false,
    cost: 'review links do not open',
  },
] as const
