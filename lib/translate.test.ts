import { describe, it, expect } from 'vitest'
import { LANGUAGES, TRANSLATIONS, getTranslation } from './translate'

describe('Multi-Language Translation Engine', () => {
  it('includes 6 core languages with flags', () => {
    expect(LANGUAGES).toHaveLength(6)
    const codes = LANGUAGES.map((l) => l.code)
    expect(codes).toEqual(['en', 'fr', 'ja', 'es', 'de', 'it'])
  })

  it('translates UI keys accurately for English', () => {
    expect(getTranslation('en', 'toc')).toBe('Table of Contents')
    expect(getTranslation('en', 'cart')).toBe('Shopping Bag')
    expect(getTranslation('en', 'unlock')).toBe('Unlock full edition')
  })

  it('translates UI keys accurately for French and Japanese', () => {
    expect(getTranslation('fr', 'toc')).toBe('Table des Matières')
    expect(getTranslation('fr', 'cart')).toBe('Panier')
    expect(getTranslation('ja', 'toc')).toBe('目次')
    expect(getTranslation('ja', 'cart')).toBe('ショッピングバッグ')
  })

  it('falls back to English when a key is missing', () => {
    expect(getTranslation('fr', 'non_existent_key')).toBe('non_existent_key')
  })
})
