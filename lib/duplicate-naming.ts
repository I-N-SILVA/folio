/**
 * What a copied edition is called.
 *
 * Small enough to have been inline in the route, and extracted because the two
 * rules in it are the kind that quietly stop holding: a slug has a length limit
 * that a chain of copies will find, and a template made from a template must
 * not become "Report template template".
 */

/** Postgres holds the slug; this keeps a chain of copies from growing past it. */
const MAX_SLUG_BASE = 80

const TEMPLATE_SUFFIX = / template$/i

function randomSuffix() {
  return Math.random().toString(36).slice(2, 6)
}

export function duplicateNames(
  original: { title: string; slug: string },
  asTemplate: boolean
): { title: string; slug: string } {
  const kind = asTemplate ? 'template' : 'copy'

  // The name an author gave a template is the one worth keeping, so saving one
  // as a template again is a no-op on the name rather than another suffix.
  const base = original.title.replace(TEMPLATE_SUFFIX, '')

  return {
    title: asTemplate ? `${base} template` : `${original.title} (Copy)`,
    slug: `${original.slug.slice(0, MAX_SLUG_BASE)}-${kind}-${randomSuffix()}`,
  }
}
