/**
 * Abuse controls shared by the reader-facing routes. No server-only imports.
 *
 * Most public reads go through the anon/user client, where the
 * `public_read_published` policies (023) already hide a suspended edition. The
 * routes that read with the service role skip those policies, and have to ask
 * this instead.
 *
 * Reads the row rather than filtering in the query on purpose: a
 * `.is('suspended_at', null)` filter errors outright on a deployment that has
 * not applied 023, and would take the reader down with it.
 */
export function isSuspended(row: { suspended_at?: string | null } | null | undefined): boolean {
  return Boolean(row?.suspended_at)
}

export const REPORT_REASONS = [
  { value: 'phishing', label: 'Phishing — it asks for a password, card or login' },
  { value: 'scam', label: 'Scam or fraud' },
  { value: 'malware', label: 'Links to malware or a harmful download' },
  { value: 'illegal', label: 'Illegal content' },
  { value: 'copyright', label: 'Uses my copyrighted work' },
  { value: 'hate', label: 'Hate or harassment' },
  { value: 'other', label: 'Something else' },
] as const

export type ReportReason = (typeof REPORT_REASONS)[number]['value']
