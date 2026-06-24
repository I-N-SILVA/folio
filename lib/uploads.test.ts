import { describe, it, expect } from 'vitest'
import { isAllowedAssetType, humanBytes, MAX_ASSET_BYTES, MAX_PDF_BYTES } from './uploads'

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
