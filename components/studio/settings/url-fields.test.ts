import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

/**
 * Every field in the inspector that holds a link or a media source has to go
 * through `urlField`, not bare `register`.
 *
 * `urlField` normalises on blur — `example.com` becomes `https://example.com`.
 * Without it a bare domain reaches `draftableHref`, which rejects it (it is
 * built on `new URL()`), and because the save route validates the whole edition
 * as one array, that one value 400s every autosave for the entire book. The
 * author sees a save that will not complete and no reason why.
 *
 * So this fails when a URL-shaped field is registered without it, including on
 * a form added later.
 */

const DIR = __dirname

/** Field names that carry a link or a media source. */
const URL_FIELD = /^(src|href|poster|source|image|buyUrl|linkUrl|stripeUrl|url|thumbnail)$/

const forms = readdirSync(DIR).filter((f) => f.endsWith('.tsx'))

describe('every link and media field normalises what the author typed', () => {
  it('found the inspector forms at all', () => {
    expect(forms.length).toBeGreaterThan(5)
  })

  it.each(forms)('%s', (file) => {
    const source = readFileSync(join(DIR, file), 'utf-8')

    // `register('src')` and register(`items.${idx}.buyUrl` as const)
    const bare = [...source.matchAll(/\bregister\(\s*[`'"]([^`'"]+)[`'"]/g)]
      .map((m) => m[1])
      .map((path) => path.split('.').pop() ?? path)
      .filter((name) => URL_FIELD.test(name))

    expect(
      bare,
      `${file} registers ${JSON.stringify(bare)} directly. Use urlField(form, name) ` +
        `from ./useBlockForm so a bare domain is normalised instead of breaking the save.`
    ).toEqual([])
  })
})

describe('the fields that are known to be wired', () => {
  const wired = (file: string, name: string) =>
    readFileSync(join(DIR, file), 'utf-8').includes(`urlField(form, `) &&
    new RegExp(`urlField\\(form, \`?['\`][^'\`]*${name}`).test(readFileSync(join(DIR, file), 'utf-8'))

  it.each([
    ['VideoBlockForm.tsx', 'src'],
    ['VideoBlockForm.tsx', 'poster'],
    ['AudioBlockForm.tsx', 'src'],
    ['ButtonBlockForm.tsx', 'href'],
    ['ImageBlockForm.tsx', 'src'],
    ['DataBlockForm.tsx', 'source'],
    ['ProductGridBlockForm.tsx', 'image'],
    ['ProductGridBlockForm.tsx', 'buyUrl'],
    ['HotspotSettingsForm.tsx', 'linkUrl'],
    ['HotspotSettingsForm.tsx', 'stripeUrl'],
  ])('%s → %s', (file, name) => {
    expect(wired(file, name), `${file} should normalise ${name}`).toBe(true)
  })
})
