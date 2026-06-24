import type { EmbedBlock } from '@/lib/book-schema'

export function EmbedBlock({ block }: { block: EmbedBlock }) {
  return (
    <div
      className="w-full overflow-hidden rounded"
      style={{ height: block.height }}
    >
      <iframe
        srcDoc={block.html}
        // Author-supplied HTML runs in a sandboxed, opaque (null) origin.
        // We deliberately omit `allow-same-origin`: combined with
        // `allow-scripts` and `srcDoc` it would give embedded scripts the
        // embedder's origin and thus access to reader cookies / storage (XSS).
        sandbox="allow-scripts allow-popups allow-popups-to-escape-sandbox allow-forms"
        referrerPolicy="no-referrer"
        className="w-full h-full border-0"
        title="Embedded content"
      />
    </div>
  )
}
