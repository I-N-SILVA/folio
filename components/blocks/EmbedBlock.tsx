import type { EmbedBlock } from '@/lib/book-schema'

export function EmbedBlock({ block }: { block: EmbedBlock }) {
  return (
    <div
      className="w-full overflow-hidden rounded"
      style={{ height: block.height }}
    >
      <iframe
        srcDoc={block.html}
        sandbox="allow-scripts allow-same-origin"
        className="w-full h-full border-0"
        title="Embedded content"
      />
    </div>
  )
}
