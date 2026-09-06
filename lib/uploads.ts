// Shared limits + validation for user-supplied file uploads. Centralised so the
// asset-upload and PDF-import routes enforce the same rules.

export const MAX_ASSET_BYTES = 25 * 1024 * 1024 // 25 MB per image/audio/video asset
export const MAX_PDF_BYTES = 50 * 1024 * 1024 // 50 MB per imported PDF

// There is deliberately no import-payload ceiling here any more. There used to
// be one, because the importer sent every rendered page in a single request and
// had to refuse documents larger than the platform's body cap. Rendered pages
// now go straight from the browser to storage, so no request carries more than
// one page and there is no aggregate size to limit. If a ceiling ever looks
// necessary again, it means the pages have been routed back through the server.

// MIME prefixes we accept for inline media assets.
const ALLOWED_ASSET_PREFIXES = ['image/', 'video/', 'audio/']

// Subtypes that match an allowed prefix but can carry executable markup. SVG in
// particular can embed <script>/onload handlers, so we never accept it as an
// uploaded asset even though it is technically an image/* type.
const BLOCKED_SUBTYPES = new Set(['svg+xml', 'xml'])

export function isAllowedAssetType(type: string): boolean {
  const normalized = type.toLowerCase().trim()
  const subtype = normalized.split('/')[1] ?? ''
  if (BLOCKED_SUBTYPES.has(subtype)) return false
  return ALLOWED_ASSET_PREFIXES.some((prefix) => normalized.startsWith(prefix))
}

/**
 * Extensions worth preserving, keyed by the MIME type we already validated.
 * The client's filename is a hint; the type is what the route actually checked.
 */
const EXTENSION_FOR_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/gif': 'gif',
  'image/webp': 'webp',
  'image/avif': 'avif',
  'video/mp4': 'mp4',
  'video/webm': 'webm',
  'video/quicktime': 'mov',
  'audio/mpeg': 'mp3',
  'audio/mp4': 'm4a',
  'audio/ogg': 'ogg',
  'audio/wav': 'wav',
  'audio/webm': 'weba',
}

/**
 * A storage-key extension for an upload, from a filename we do not trust.
 *
 * `/api/upload` built its key as `` `…/${crypto.randomUUID()}.${file.name.split('.').pop()}` ``,
 * which hands a segment of the key to the client. `File.name` out of a
 * multipart body is an arbitrary string: "photo" (no dot) makes the extension
 * `photo`, "a../../../x" makes it `/x` — two extra path segments — and
 * "weird.$(id)" goes in verbatim. Nothing escapes the book's own asset prefix,
 * because the last `.` swallows any `..` before it, so this is hygiene rather
 * than a way into somebody else's edition. It is still the client choosing part
 * of a path, and the fix costs nothing.
 *
 * The MIME type is the authority — the route has already checked it against
 * `isAllowedAssetType`. A filename extension is used only when it is plainly an
 * extension and the type is one we have no mapping for, and `bin` is the
 * fallback rather than nothing, so a key never ends in a bare dot.
 */
export function safeAssetExtension(fileName: string, mimeType: string): string {
  const mapped = EXTENSION_FOR_TYPE[mimeType.toLowerCase().trim()]
  if (mapped) return mapped

  const dot = fileName.lastIndexOf('.')
  const candidate = dot === -1 ? '' : fileName.slice(dot + 1).toLowerCase()
  return /^[a-z0-9]{1,8}$/.test(candidate) ? candidate : 'bin'
}

export function humanBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  return `${Math.round(bytes / 1024)} KB`
}
