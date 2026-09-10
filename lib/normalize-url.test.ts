import { describe, it, expect } from 'vitest'
import { normalizeLink } from './normalize-url'
import { ButtonBlockSchema, HotspotSchema } from './book-schema'

const savesAsHref = (href: string) =>
  ButtonBlockSchema.safeParse({ type: 'button', id: 'b', label: 'x', href, variant: 'primary' }).success

describe('what an author types becomes a link that saves', () => {
  // Each of these was rejected by draftableHref, which 400'd the save for the
  // whole edition, because `new URL('example.com')` throws.
  it.each([
    ['example.com', 'https://example.com'],
    ['www.example.com', 'https://www.example.com'],
    ['qlico.app/pricing', 'https://qlico.app/pricing'],
    ['sub.domain.co.uk/a?b=1#top', 'https://sub.domain.co.uk/a?b=1#top'],
    ['  example.com  ', 'https://example.com'],
  ])('%j → %j, and then saves', (typed, expected) => {
    expect(normalizeLink(typed)).toBe(expected)
    expect(savesAsHref(normalizeLink(typed))).toBe(true)
  })
})

describe('what it must leave alone', () => {
  it.each([
    'https://example.com',
    'http://example.com',
    'https://qlico.app/pricing?a=1#top',
    'mailto:hello@qlico.app',
    'tel:+441234567890',
    '/about',
    '',
  ])('%j is unchanged', (value) => {
    expect(normalizeLink(value)).toBe(value)
  })

  it('leaves an empty draft empty rather than inventing a scheme', () => {
    expect(normalizeLink('   ')).toBe('')
  })

  it('does not turn prose into a link', () => {
    expect(normalizeLink('coming soon')).toBe('coming soon')
    expect(normalizeLink('ask me')).toBe('ask me')
  })

  it('does not infer a scheme for a protocol-relative host', () => {
    expect(normalizeLink('//evil.test')).toBe('//evil.test')
  })
})

describe('it never launders a dangerous scheme', () => {
  // Normalising must not be a way to smuggle something past the schema: these
  // keep their scheme, reach draftableHref, and are refused there.
  it.each(['javascript:alert(1)', 'JavaScript:alert(1)', 'vbscript:msgbox(1)', 'data:text/html,<script>'])(
    '%j is passed through untouched and still refused',
    (value) => {
      expect(normalizeLink(value)).toBe(value)
      expect(savesAsHref(normalizeLink(value))).toBe(false)
    }
  )
})

describe('the same holds for a hotspot link', () => {
  it('a bare domain saves once normalised', () => {
    const hotspot = (linkUrl: string) =>
      HotspotSchema.safeParse({
        id: 'h', x: 1, y: 1, label: 'l', action: 'link', linkUrl,
        modal: { title: 't', body: 'b' },
      }).success

    expect(hotspot('shop.example.com')).toBe(false)
    expect(hotspot(normalizeLink('shop.example.com'))).toBe(true)
  })
})
