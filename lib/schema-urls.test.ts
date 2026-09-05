import { describe, it, expect } from 'vitest'
import { ButtonBlockSchema, ImageBlockSchema } from './book-schema'

const button = (href: string) =>
  ButtonBlockSchema.safeParse({
    id: 'b',
    type: 'button',
    label: 'Go',
    href,
    variant: 'primary',
    target: '_blank',
  })

const image = (src: string) => ImageBlockSchema.safeParse({ id: 'i', type: 'image', src, alt: '' })

describe('link targets', () => {
  it('accepts the links a button actually needs', () => {
    expect(button('https://example.org/thing').success).toBe(true)
    expect(button('http://example.org/thing').success).toBe(true)
    expect(button('mailto:hello@example.org').success).toBe(true)
    expect(button('tel:+441234567890').success).toBe(true)
    expect(button('/pricing').success).toBe(true)
  })

  it('accepts empty, because a block starts before it has a destination', () => {
    expect(button('').success).toBe(true)
  })

  it('refuses a data: URI in an href', () => {
    // Rendered into <a href>, a data: URI is a navigation target. Browsers block
    // top-level data: navigation, but that is a mitigation to not depend on.
    expect(button('data:text/html,<script>alert(1)</script>').success).toBe(false)
  })

  it('refuses javascript: and other schemes', () => {
    expect(button('javascript:alert(1)').success).toBe(false)
    expect(button('file:///etc/passwd').success).toBe(false)
  })

  it('refuses a protocol-relative path, which leaves the site silently', () => {
    expect(button('//evil.example/phish').success).toBe(false)
  })
})

describe('media sources', () => {
  it('still allows an inlined image, which is a legitimate src', () => {
    expect(image('data:image/png;base64,iVBORw0KGgo=').success).toBe(true)
  })

  it('allows http(s) and same-origin uploads', () => {
    expect(image('https://cdn.example/a.jpg').success).toBe(true)
    expect(image('/uploads/a.jpg').success).toBe(true)
  })

  it('allows empty while drafting, which publish-checks then blocks', () => {
    expect(image('').success).toBe(true)
  })
})
