import { BlockSchema, type Block } from './book-schema'

/**
 * Copying blocks between pages, editions and tabs.
 *
 * The obvious implementation is a field on the editor store, and it is wrong in
 * the case that matters: a studio's second client project. Copying a hero out of
 * last month's edition and into this month's is the whole point, and an
 * in-memory clipboard is gone the moment you navigate to the other edition.
 *
 * `localStorage` is per-origin, so it survives navigation and a reload and is
 * shared across tabs. It is not the system clipboard — reading that needs a
 * permission prompt and gives you a string you have to trust — so Cmd+C here
 * does not put anything on the OS clipboard, and pasting from another app is
 * not a thing this offers. That is a smaller promise, kept, rather than a
 * bigger one that fails in a permissions dialog.
 */

const KEY = 'qlico:block-clipboard'

/** Beyond this the copy is almost certainly a mistake, and the quota is real. */
const MAX_BLOCKS = 50
const MAX_BYTES = 400_000

interface Clip {
  blocks: Block[]
  copiedAt: number
}

export function writeClipboard(blocks: Block[]): boolean {
  if (blocks.length === 0 || blocks.length > MAX_BLOCKS) return false
  try {
    const payload = JSON.stringify({ blocks, copiedAt: Date.now() } satisfies Clip)
    if (payload.length > MAX_BYTES) return false
    localStorage.setItem(KEY, payload)
    return true
  } catch {
    // Private mode, a full quota, or storage disabled. Copying quietly not
    // working is better than an editor that throws on Cmd+C.
    return false
  }
}

/**
 * What is on the clipboard, validated.
 *
 * `localStorage` is writable by anything running on the origin and survives a
 * deploy, so what comes back is a string from an older version of the app at
 * best. Every block is parsed through the schema and anything that fails is
 * dropped, rather than being spread into a page and failing at save time with
 * "Could not save these pages".
 */
export function readClipboard(): Block[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as Clip
    if (!Array.isArray(parsed?.blocks)) return []
    return parsed.blocks
      .map((b) => BlockSchema.safeParse(b))
      .filter((r) => r.success)
      .map((r) => r.data as Block)
  } catch {
    return []
  }
}

export function clearClipboard() {
  try {
    localStorage.removeItem(KEY)
  } catch {
    // Nothing to do; see writeClipboard.
  }
}

/**
 * Fresh ids for a paste.
 *
 * Two blocks with the same id on one page is the kind of thing React renders
 * once and then updates the wrong one of, so this is not optional. Frames are
 * nudged so a paste onto the same canvas page is visibly a second copy rather
 * than one block exactly on top of another.
 */
export function rekeyForPaste(blocks: Block[], offsetFrames: boolean): Block[] {
  return blocks.map((block) => {
    const next = { ...JSON.parse(JSON.stringify(block)), id: crypto.randomUUID() } as Block
    if (offsetFrames && next.frame) {
      next.frame = {
        ...next.frame,
        x: Math.min(92, next.frame.x + 3),
        y: Math.min(92, next.frame.y + 3),
      }
    }
    return next
  })
}
