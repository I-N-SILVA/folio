import 'server-only'
import { randomBytes } from 'node:crypto'

/**
 * A review link's token is the whole credential, so it is generated like one.
 *
 * 32 bytes of CSPRNG output, base64url so it survives a URL and a double-click
 * without escaping. Not a uuid: a uuid is 122 bits and, more to the point,
 * reads like an identifier people feel free to paste into a bug report.
 */
export function newReviewToken(): string {
  return randomBytes(32).toString('base64url')
}

/** Where a reviewer is sent. Relative, so it works on any deployment. */
export function reviewPath(token: string): string {
  return `/review/${token}`
}

/**
 * How long a link may live. An expiry is optional — a client review that drags
 * on for a month is normal — but an unbounded default is how a link handed to a
 * contractor in March is still live in December.
 */
export const REVIEW_LINK_DAYS = 30
