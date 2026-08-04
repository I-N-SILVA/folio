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

export function humanBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`
  return `${Math.round(bytes / 1024)} KB`
}
