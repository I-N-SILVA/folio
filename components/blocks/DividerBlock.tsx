import type { DividerBlock } from '@/lib/book-schema'

export function DividerBlock({ block }: { block: DividerBlock }) {
  return <hr className="w-full border-t border-current opacity-20 my-2" />
}
