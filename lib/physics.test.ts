import { describe, it, expect } from 'vitest'
import { ThemeSchema } from '@/lib/book-schema'
import { type PaperPhysics } from '@/lib/sound'

describe('Paper Physics & Tactile Modeling', () => {
  it('validates paperPhysics enum in ThemeSchema', () => {
    const validPresets: PaperPhysics[] = ['magazine', 'hardcover', 'washi']

    for (const physics of validPresets) {
      const parsed = ThemeSchema.safeParse({
        preset: 'ivory',
        paperPhysics: physics,
      })
      expect(parsed.success).toBe(true)
    }
  })

  it('rejects invalid paperPhysics preset', () => {
    const parsed = ThemeSchema.safeParse({
      preset: 'ivory',
      paperPhysics: 'unsupported-weight',
    })
    expect(parsed.success).toBe(false)
  })
})
