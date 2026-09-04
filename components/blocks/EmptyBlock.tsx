'use client'

import { twMerge } from 'tailwind-merge'

/**
 * What a media block looks like before its source is chosen.
 *
 * Blocks used to arrive pre-filled so they would validate — a new Video block
 * held `w3schools.com/html/mov_bbb.mp4`, a new Product Grid a $480 silk trench
 * with a working Add to Bag button. On a long import nobody notices, and it
 * publishes under the author's name.
 *
 * An empty block that names what it needs is better product and less code. The
 * frame is deliberately quiet — it is a gap in a draft, not an error — and
 * `lib/publish-checks.ts` is what stops an edition going live still holding one.
 */
export function EmptyBlock({
  label,
  icon,
  aspect = 'aspect-video',
  className,
}: {
  /** What the author still has to supply, in their words: "Choose a video". */
  label: string
  icon?: React.ReactNode
  aspect?: string
  className?: string
}) {
  return (
    <div
      className={twMerge(
        'flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-current/25 bg-current/[0.03] p-6 text-center opacity-60',
        aspect,
        className
      )}
    >
      {icon ? <span aria-hidden="true">{icon}</span> : null}
      <span className="text-xs font-medium">{label}</span>
    </div>
  )
}
