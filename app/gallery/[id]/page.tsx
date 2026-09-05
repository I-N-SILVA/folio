import Link from 'next/link'
import { notFound } from 'next/navigation'
import type { Metadata } from 'next'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { ViewerChrome } from '@/components/viewer/ViewerChrome'
import { TEMPLATES } from '@/data/templates'

/**
 * A gallery edition, rendered in the real reader.
 *
 * No database, no owner, no seeding: `generateBook` already returns a complete
 * Book, so the same `ViewerChrome` a published edition uses can render one
 * straight from the template. That means the gallery is never out of sync with
 * what "Start from this" actually gives you — they are the same object.
 */

interface Props {
  params: Promise<{ id: string }>
}

/** Six known ids, so every gallery page is prerendered. */
export function generateStaticParams() {
  return TEMPLATES.map((t) => ({ id: t.id }))
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params
  const tmpl = TEMPLATES.find((t) => t.id === id)
  if (!tmpl) return { title: 'Edition not found' }
  return {
    title: `${tmpl.title} — a QLICO edition`,
    description: tmpl.subtitle,
  }
}

export default async function GalleryEditionPage({ params }: Props) {
  const { id } = await params
  const tmpl = TEMPLATES.find((t) => t.id === id)
  if (!tmpl) notFound()

  // Deterministic ids: this page is prerendered, and a random id per build would
  // make the analytics events it fires unattributable to anything.
  const book = tmpl.generateBook(`gallery-${tmpl.id}`, 'gallery', `gallery-${tmpl.id}`)

  return (
    <>
      <div className="fixed left-0 right-0 top-0 z-[9100] flex flex-wrap items-center justify-between gap-3 border-b border-[var(--qlico-border)] bg-[var(--qlico-paper)]/90 px-4 py-2.5 backdrop-blur-md">
        <Link
          href="/gallery"
          className="flex items-center gap-1.5 text-xs font-semibold text-[var(--qlico-muted)] transition-colors hover:text-[var(--qlico-ink)]"
        >
          <ArrowLeft size={14} />
          All editions
        </Link>

        <p className="hidden min-w-0 flex-1 truncate text-center text-xs text-[var(--qlico-muted)] sm:block">
          <span className="font-semibold text-[var(--qlico-ink)]">{tmpl.title}</span> — a QLICO
          template, shown exactly as a reader sees it
        </p>

        <Link
          href={`/dashboard?new=1&template=${tmpl.id}`}
          className="flex items-center gap-1.5 rounded-full bg-[var(--accent)] px-4 py-1.5 text-xs font-semibold text-[var(--accent-contrast)] transition-colors hover:bg-[var(--accent-hover)]"
        >
          Start from this
          <ArrowRight size={13} />
        </Link>
      </div>

      {/* The gallery is QLICO's own shop window, so the badge stays on. */}
      <div className="pt-12">
        <ViewerChrome book={book} showBadge />
      </div>
    </>
  )
}
