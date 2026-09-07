/**
 * How much history an edition keeps, and how often it takes a point.
 *
 * Both numbers are shared between the route that writes versions and the one
 * that lists them, so the editor can say "roughly every half hour, last 20"
 * without a second copy drifting out of step with the database.
 *
 * Thirty minutes is chosen against the autosave rather than against the clock:
 * `PUT /api/books/[id]/pages` fires every couple of seconds while somebody is
 * typing, so an unthrottled snapshot would make a day's work nine hundred rows
 * of near-identical jsonb and a history nobody can read.
 */
export const AUTO_SNAPSHOT_GAP_MINUTES = 30

/** Kept per edition. A safety net, not an archive. */
export const VERSIONS_KEPT = 20

/** "3 minutes ago", "yesterday" — a timeline is unreadable as timestamps. */
export function relativeTime(iso: string, now: Date = new Date()): string {
  const then = new Date(iso)
  const seconds = Math.round((now.getTime() - then.getTime()) / 1000)
  if (!Number.isFinite(seconds)) return ''
  if (seconds < 45) return 'just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} minute${minutes === 1 ? '' : 's'} ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} hour${hours === 1 ? '' : 's'} ago`
  const days = Math.round(hours / 24)
  if (days === 1) return 'yesterday'
  if (days < 7) return `${days} days ago`
  return then.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
