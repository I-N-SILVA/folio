import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { TYPESETS, getTypeset, resolveFontFamily, typesetCssVars } from '@/lib/typesets'
import { TextBlockSchema, THEME_PRESETS } from '@/lib/book-schema'

/**
 * The bug these tests are written against is the one this repo keeps shipping:
 * a control that looks like it works.
 *
 * The theme presets and the studio's four "font pairings" named eight Google
 * families and loaded none of them, so every pairing button produced identical
 * output and no automated check could tell — typecheck, lint and the whole
 * suite were green. The only thing that would have caught it is an assertion
 * that a font an author can pick is a font the app actually serves, so that is
 * the first test here.
 */

/** Every `variable:` a next/font call in lib/fonts.ts declares. */
function loadedFontVariables(): string[] {
  const src = readFileSync(join(process.cwd(), 'lib', 'fonts.ts'), 'utf8')
  return [...src.matchAll(/variable:\s*'(--[a-z-]+)'/g)].map((m) => m[1])
}

describe('every font a type set names is a font that is loaded', () => {
  it('has a next/font call for each family', () => {
    const loaded = loadedFontVariables()
    const named = TYPESETS.flatMap((t) => [t.headingVar, t.bodyVar])
    const missing = named.filter((v) => !loaded.includes(v))
    expect(
      missing,
      `${missing.join(', ')} is named by a type set but never loaded — it renders as the browser default`
    ).toEqual([])
  })

  it('maps every legacy font name onto a loaded family', () => {
    const loaded = loadedFontVariables()
    // The names editions already have stored on them, from the presets and the
    // pairing buttons that used to exist.
    const legacy = [
      'Playfair Display',
      'Cormorant Garamond',
      'Syne',
      'Cinzel',
      'Sora',
      'Lora',
      'DM Serif Display',
      'DM Sans',
      'Plus Jakarta Sans',
      'Inter',
      'Source Serif 4',
      'Space Grotesk',
      'IBM Plex Sans',
    ]
    for (const name of legacy) {
      const resolved = resolveFontFamily(name)
      expect(resolved, `${name} has no mapping`).toMatch(/^var\(--font-[a-z-]+\)$/)
      expect(loaded).toContain(resolved!.slice(4, -1))
    }
  })
})

describe('resolveFontFamily', () => {
  it('passes a font stack through instead of quoting it', () => {
    // The renderer used to wrap whatever it was given in quotes, so the
    // dropdown value `Georgia, serif` became the single nonexistent family
    // `"Georgia, serif"` and every choice silently fell back to sans-serif.
    expect(resolveFontFamily('Georgia, serif')).toBe('Georgia, serif')
    expect(resolveFontFamily('"Courier New", monospace')).toBe('"Courier New", monospace')
  })

  it('gives an unknown single family a real fallback', () => {
    const resolved = resolveFontFamily('Comic Sans MS')
    expect(resolved).toContain('"Comic Sans MS"')
    expect(resolved).toContain('var(--font-outfit)')
  })

  it('has nothing to resolve for an empty or absent choice', () => {
    expect(resolveFontFamily(undefined)).toBeNull()
    expect(resolveFontFamily('   ')).toBeNull()
  })
})

describe('type set completeness', () => {
  const variants = TextBlockSchema.shape.variant.options

  it('styles every text variant the editor can produce', () => {
    for (const t of TYPESETS) {
      const missing = variants.filter((v) => !t.variants[v])
      expect(missing, `${t.id} has no style for ${missing.join(', ')}`).toEqual([])
    }
  })

  it('gives every variant a size, weight, leading and tracking', () => {
    for (const t of TYPESETS) {
      for (const [name, style] of Object.entries(t.variants)) {
        expect(style.size, `${t.id}.${name}.size`).toBeTruthy()
        expect(style.lineHeight, `${t.id}.${name}.lineHeight`).toBeTruthy()
        expect(style.letterSpacing, `${t.id}.${name}.letterSpacing`).toBeTruthy()
        expect(style.weight, `${t.id}.${name}.weight`).toBeGreaterThan(0)
      }
    }
  })

  it('actually differs between styles, rather than being five names for one scale', () => {
    // Four buttons that rendered identically is the failure this replaces.
    const titles = TYPESETS.map((t) => JSON.stringify(t.variants.title))
    expect(new Set(titles).size).toBe(TYPESETS.length)
  })

  it('has a unique id per style', () => {
    expect(new Set(TYPESETS.map((t) => t.id)).size).toBe(TYPESETS.length)
  })
})

describe('getTypeset', () => {
  it('falls back rather than throwing on an unknown id', () => {
    // A stored theme can name a style that has since been renamed. That should
    // be a plain-looking edition, not a crashed reader.
    expect(getTypeset('no-such-style').id).toBe(TYPESETS[0].id)
    expect(getTypeset(undefined).id).toBe(TYPESETS[0].id)
  })

  it('resolves every preset default', () => {
    for (const preset of Object.values(THEME_PRESETS)) {
      expect(TYPESETS.map((t) => t.id)).toContain(preset.typeset)
    }
  })
})

describe('typesetCssVars', () => {
  const editorial = getTypeset('editorial')

  it('emits a variable per property per variant', () => {
    const vars = typesetCssVars(editorial)
    expect(vars['--t-title-size']).toBe(editorial.variants.title.size)
    expect(vars['--t-title-weight']).toBe('700')
    expect(vars['--t-caption-style']).toBe('italic')
    expect(vars['--t-body-transform']).toBe('none')
  })

  it('points a heading variant at the heading family and a body variant at the body one', () => {
    const vars = typesetCssVars(editorial)
    expect(vars['--t-title-family']).toBe('var(--heading-font)')
    expect(vars['--t-body-family']).toBe('var(--body-font)')
  })

  it('lets a theme-level font override the type set, and falls back when it does not', () => {
    const overridden = typesetCssVars(editorial, { headingFont: 'Georgia, serif' })
    expect(overridden['--heading-font']).toContain('Georgia, serif')
    // The body was not overridden, so it stays on the type set's own family.
    expect(overridden['--body-font']).toContain('var(--font-outfit)')
  })

  it('never emits a quoted font stack', () => {
    // `font-family: "Georgia, serif"` is one nonexistent family, not two fonts,
    // and it is exactly what the old renderer produced from every dropdown
    // value. A comma inside a single quoted name is the signature.
    const quotedNames = (value: string) => value.split('"').filter((_, i) => i % 2 === 1)

    for (const t of TYPESETS) {
      const vars = typesetCssVars(t, { headingFont: 'Palatino, "Palatino Linotype", serif' })
      for (const value of Object.values(vars)) {
        for (const name of quotedNames(value)) {
          expect(name, `"${name}" in ${value} is a stack quoted as one family`).not.toContain(',')
        }
      }
    }
  })

  it('ends a sans type set in a sans fallback and a serif one in a serif', () => {
    // One shared fallback for both roles put IBM Plex Sans in front of
    // `Georgia, serif`, so the one time it mattered the reader got a serif.
    expect(typesetCssVars(getTypeset('technical'))['--heading-font']).toContain('sans-serif')
    expect(typesetCssVars(getTypeset('journal'))['--heading-font']).toContain('serif')
    expect(typesetCssVars(getTypeset('technical'))['--heading-font']).not.toContain('Georgia')
  })
})
