/**
 * What an author types into a link field, turned into what a link field means.
 *
 * `draftableHref` is right to be strict — it guards what gets rendered into an
 * `<a href>` on a public page. But it is built on `new URL()`, which throws on
 * `example.com`, so the single most common thing a person types was rejected,
 * and because the save route validates the whole edition as one array, that one
 * value 400'd every autosave for the entire book.
 *
 * Loosening the schema would be the wrong fix — a bare domain is genuinely not
 * a URL, and `<a href="example.com">` navigates to a *relative path* called
 * "example.com", which is a broken link either way. So normalise at the input
 * instead: the author gets what they meant, and the schema keeps its teeth.
 */

/** Anything already carrying a scheme — http:, mailto:, and also javascript:. */
const HAS_SCHEME = /^[a-z][a-z0-9+.-]*:/i

/**
 * A bare host, optionally with a path, query or fragment: `example.com`,
 * `www.example.com`, `qlico.app/pricing?a=1`. Requires at least one dot and no
 * whitespace, so ordinary prose is left alone rather than turned into a link.
 */
const BARE_HOST = /^[a-z0-9]([a-z0-9-]*[a-z0-9])?(\.[a-z0-9]([a-z0-9-]*[a-z0-9])?)+([/?#].*)?$/i

/**
 * Normalises a link an author typed. Returns it unchanged when there is nothing
 * safe to infer — this only ever adds a scheme it is confident about, and never
 * removes or rewrites one that is already there (stripping a dangerous scheme is
 * the schema's job, not this function's).
 */
export function normalizeLink(raw: string): string {
  const value = raw.trim()
  if (value === '') return ''

  // Already explicit — http, https, mailto, tel, and anything else. Left alone
  // on purpose: `javascript:` has to reach the schema to be refused there, not
  // be quietly reshaped here into something that looks fine.
  if (HAS_SCHEME.test(value)) return value

  // A same-origin path, or a protocol-relative "//host" which is not a thing we
  // want to start inferring a scheme for.
  if (value.startsWith('/')) return value

  if (BARE_HOST.test(value)) return `https://${value}`

  // Not recognisably a link. Hand it back untouched and let the schema decide —
  // guessing here would turn a typo into a confident wrong answer.
  return value
}

/**
 * The same, for a media source. Identical rules today; kept separate because a
 * media field also legitimately holds a `data:` URI and a storage path, and the
 * two are likely to diverge before they converge.
 */
export function normalizeMediaSrc(raw: string): string {
  return normalizeLink(raw)
}
