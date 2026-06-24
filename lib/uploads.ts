// Shared limits + validation for user-supplied file uploads. Centralised so the
// asset-upload and PDF-import routes enforce the same rules.

export const MAX_ASSET_BYTES = 25 * 1024 * 1024 // 25 MB per image/audio/video asset
export const MAX_PDF_BYTES = 50 * 1024 * 1024 // 50 MB per imported PDF

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
