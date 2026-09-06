import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { describe, it, expect } from 'vitest'
import {
  isAllowedAssetType,
  humanBytes,
  MAX_ASSET_BYTES,
  MAX_PDF_BYTES,
  safeAssetExtension,
} from './uploads'

describe('isAllowedAssetType', () => {
  it('allows image, video and audio MIME types', () => {
    expect(isAllowedAssetType('image/png')).toBe(true)
    expect(isAllowedAssetType('video/mp4')).toBe(true)
    expect(isAllowedAssetType('audio/mpeg')).toBe(true)
  })

  it('rejects executables, html and empty types', () => {
    expect(isAllowedAssetType('text/html')).toBe(false)
    expect(isAllowedAssetType('application/x-msdownload')).toBe(false)
    expect(isAllowedAssetType('application/pdf')).toBe(false)
    expect(isAllowedAssetType('')).toBe(false)
  })

  it('rejects scriptable image subtypes (SVG/XML)', () => {
    expect(isAllowedAssetType('image/svg+xml')).toBe(false)
    expect(isAllowedAssetType('IMAGE/SVG+XML')).toBe(false)
    expect(isAllowedAssetType('image/xml')).toBe(false)
  })
})

describe('humanBytes', () => {
  it('formats MB and KB', () => {
    expect(humanBytes(25 * 1024 * 1024)).toBe('25 MB')
    expect(humanBytes(512 * 1024)).toBe('512 KB')
  })
})

describe('limits', () => {
  it('are sane and ordered', () => {
    expect(MAX_ASSET_BYTES).toBeGreaterThan(0)
    expect(MAX_PDF_BYTES).toBeGreaterThanOrEqual(MAX_ASSET_BYTES)
  })
})

describe('safeAssetExtension', () => {
  it('takes the extension from the type the route validated', () => {
    expect(safeAssetExtension('whatever', 'image/png')).toBe('png')
    expect(safeAssetExtension('photo.jpeg', 'image/jpeg')).toBe('jpg')
    expect(safeAssetExtension('clip.MOV', 'video/quicktime')).toBe('mov')
  })

  it('never lets the filename put a path segment in the key', () => {
    // What the old `file.name.split('.').pop()` produced, in order: two extra
    // segments, a shell-looking string, an encoded traversal, and the whole
    // filename when there was no dot at all.
    for (const name of [
      'a../../../x',
      'weird.$(id)',
      'x.%2e%2e/y',
      'photo',
      '../../../etc/passwd',
    ]) {
      expect(safeAssetExtension(name, 'application/octet-stream')).toMatch(/^[a-z0-9]{1,8}$/)
    }
  })

  it('falls back to bin rather than to nothing', () => {
    // A key ending in a bare dot is what an empty extension used to produce.
    expect(safeAssetExtension('no-ext.', 'application/octet-stream')).toBe('bin')
    expect(safeAssetExtension('', '')).toBe('bin')
  })

  it('keeps a plain filename extension when the type is unmapped', () => {
    expect(safeAssetExtension('track.flac', 'audio/flac')).toBe('flac')
    expect(safeAssetExtension('archive.tar.gz', 'application/gzip')).toBe('gz')
  })

  it('is what the upload route actually calls', () => {
    const src = readFileSync(join(__dirname, '..', 'app', 'api', 'upload', 'route.ts'), 'utf8')
    expect(src).toContain('safeAssetExtension(file.name, file.type)')
    expect(src).not.toContain("file.name.split('.').pop()")
  })
})
