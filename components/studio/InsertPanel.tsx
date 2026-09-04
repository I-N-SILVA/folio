'use client'

import { useMemo, useRef, useState } from 'react'
import { twMerge } from 'tailwind-merge'
import {
  Type,
  Heading1,
  Quote,
  Minus,
  Image as ImageIcon,
  Video,
  Music,
  MousePointerClick,
  Code2,
  ShoppingBag,
  Activity,
  Search,
  X,
} from 'lucide-react'
import { Modal } from '@/components/ui/Modal'
import { PAGE_TEMPLATES, type PageTemplate } from '@/lib/templates'
import type { Block } from '@/lib/book-schema'

/**
 * The one place blocks and layouts come from.
 *
 * There used to be six: this modal, a "Blocks" tab in the page sidebar holding a
 * second set of presets, a "Layouts" tab, three hardcoded starter scaffolds on
 * an empty canvas, the Asset Library, and the whole-publication templates in the
 * create modal. Four of them inserted blocks, and two of them inserted the *same*
 * block with different defaults — Image was `lightbox: false` here and `true` in
 * the sidebar. An author had no way to know which surface to reach for.
 *
 * Two entry points now, both landing here: `/` with nothing focused, and the `+`
 * that appears between two blocks. `⌘K` still opens the command palette.
 */

export interface BlockChoice {
  id: string
  group: 'Text' | 'Media' | 'Interactive'
  label: string
  /** What it is for, so the picker never relies on an icon carrying the meaning. */
  hint: string
  icon: React.ReactNode
  /** Extra words the search should match but the row need not show. */
  keywords?: string
  make: () => Block
}

const uid = () => crypto.randomUUID()

/**
 * Every media default is *empty*.
 *
 * A new Video block used to arrive holding `w3schools.com/html/mov_bbb.mp4` and
 * Audio a w3schools horse sample; a Product Grid arrived holding a $480 silk
 * trench with a working Add to Bag button. On a forty-page import nobody notices,
 * and it publishes. An empty block that says what it needs is better product and
 * less code than curated fake content.
 */
export const BLOCK_CHOICES: BlockChoice[] = [
  {
    id: 'heading',
    group: 'Text',
    label: 'Heading',
    hint: 'A section title',
    icon: <Heading1 size={17} />,
    keywords: 'title h1 h2',
    make: () => ({ id: uid(), type: 'text', variant: 'heading', content: 'New heading', align: 'left' }),
  },
  {
    id: 'body',
    group: 'Text',
    label: 'Body text',
    hint: 'A paragraph',
    icon: <Type size={17} />,
    keywords: 'paragraph copy prose',
    make: () => ({ id: uid(), type: 'text', variant: 'body', content: '', align: 'left' }),
  },
  {
    id: 'quote',
    group: 'Text',
    label: 'Quote',
    hint: 'A pull quote, set large',
    icon: <Quote size={17} />,
    keywords: 'pullquote citation',
    make: () => ({ id: uid(), type: 'text', variant: 'quote', content: '', align: 'left' }),
  },
  {
    id: 'caption',
    group: 'Text',
    label: 'Caption',
    hint: 'A small label above or below',
    icon: <Type size={14} />,
    keywords: 'label eyebrow kicker',
    make: () => ({ id: uid(), type: 'text', variant: 'caption', content: '', align: 'left' }),
  },
  {
    id: 'divider',
    group: 'Text',
    label: 'Divider',
    hint: 'A rule between sections',
    icon: <Minus size={17} />,
    keywords: 'rule line separator hr',
    make: () => ({ id: uid(), type: 'divider' }),
  },
  {
    id: 'image',
    group: 'Media',
    label: 'Image',
    hint: 'Empty until you choose one',
    icon: <ImageIcon size={17} />,
    keywords: 'photo picture illustration',
    make: () => ({ id: uid(), type: 'image', src: '', alt: '', lightbox: true }),
  },
  {
    id: 'video',
    group: 'Media',
    label: 'Video',
    hint: 'Empty until you choose one',
    icon: <Video size={17} />,
    keywords: 'film mp4 clip',
    make: () => ({ id: uid(), type: 'video', src: '', autoplay: false, muted: true }),
  },
  {
    id: 'audio',
    group: 'Media',
    label: 'Audio',
    hint: 'Narration or a track',
    icon: <Music size={17} />,
    keywords: 'sound music voice',
    make: () => ({ id: uid(), type: 'audio', src: '', title: '', waveform: false }),
  },
  {
    /**
     * The block the README leads with, and the one the picker could not reach.
     * `BLOCK_GROUPS` listed 'data' under Interactive; `BLOCK_TYPES` had no entry
     * for it, so `if (!choice) return null` rendered nothing and a headline
     * feature was silently unavailable. The renderer, settings form and schema
     * were all there the whole time.
     */
    id: 'data',
    group: 'Interactive',
    label: 'Live data',
    hint: 'Figures that stay true after you send it',
    icon: <Activity size={17} />,
    keywords: 'metric number stat kpi live',
    make: () => ({ id: uid(), type: 'data', label: 'Metric', source: '', path: '' }),
  },
  {
    id: 'button',
    group: 'Interactive',
    label: 'Button',
    hint: 'One measured call to action',
    icon: <MousePointerClick size={17} />,
    keywords: 'cta link action',
    make: () => ({ id: uid(), type: 'button', label: 'Do the thing', href: '', variant: 'primary', target: '_blank' }),
  },
  {
    id: 'product-grid',
    group: 'Interactive',
    label: 'Product grid',
    hint: 'Products with prices and a buy link',
    icon: <ShoppingBag size={17} />,
    keywords: 'shop commerce store catalogue',
    make: () => ({ id: uid(), type: 'product-grid', columns: '2', cardStyle: 'bordered', aspectRatio: '1/1', items: [] }),
  },
  {
    id: 'embed',
    group: 'Interactive',
    label: 'Embed',
    hint: 'Paste third-party HTML',
    icon: <Code2 size={17} />,
    keywords: 'iframe html widget',
    make: () => ({ id: uid(), type: 'embed', html: '', height: 300 }),
  },
]

const GROUP_ORDER: BlockChoice['group'][] = ['Text', 'Media', 'Interactive']

function matchesQuery(haystack: string, q: string) {
  return haystack.toLowerCase().includes(q)
}

interface Props {
  onInsertBlock: (block: Block) => void
  /** Layouts add a page rather than overwriting the one the author is on. */
  onInsertLayout: (template: PageTemplate) => void
  onClose: () => void
}

export function InsertPanel({ onInsertBlock, onInsertLayout, onClose }: Props) {
  const [tab, setTab] = useState<'blocks' | 'layouts'>('blocks')
  const [query, setQuery] = useState('')
  const [cursor, setCursor] = useState(0)
  const listRef = useRef<HTMLDivElement>(null)

  const q = query.trim().toLowerCase()

  const blocks = useMemo(
    () =>
      BLOCK_CHOICES.filter(
        (b) => !q || matchesQuery(`${b.label} ${b.hint} ${b.group} ${b.keywords ?? ''}`, q)
      ),
    [q]
  )

  const layouts = useMemo(
    () => PAGE_TEMPLATES.filter((t) => !q || matchesQuery(`${t.label} ${t.description}`, q)),
    [q]
  )

  // A query that only matches layouts should show them, rather than an empty
  // Blocks tab the author has to work out how to leave. Derived rather than
  // pushed into state from an effect, which would cascade a second render.
  const activeTab = q && blocks.length === 0 && layouts.length > 0 ? 'layouts' : tab
  const active = activeTab === 'blocks' ? blocks : layouts

  // Filtering can shorten the list under the cursor; clamping on the way out
  // beats resetting it from an effect.
  const cursorIndex = Math.min(cursor, Math.max(0, active.length - 1))

  function commit(index: number) {
    if (activeTab === 'blocks') {
      const choice = blocks[index]
      if (choice) onInsertBlock(choice.make())
    } else {
      const tpl = layouts[index]
      if (tpl) onInsertLayout(tpl)
    }
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      if (!active.length) return
      const next = (cursorIndex + (e.key === 'ArrowDown' ? 1 : -1) + active.length) % active.length
      setCursor(next)
      listRef.current
        ?.querySelectorAll('[data-row]')
        [next]?.scrollIntoView({ block: 'nearest' })
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      commit(cursorIndex)
      return
    }
    if (e.key === 'Tab') {
      e.preventDefault()
      setTab(activeTab === 'blocks' ? 'layouts' : 'blocks')
      setCursor(0)
    }
  }

  let flat = -1

  return (
    <Modal
      onClose={onClose}
      title="Insert"
      hideCloseButton
      className="w-[440px] max-w-[calc(100vw-2rem)] overflow-hidden border border-neutral-700 bg-neutral-900 p-0"
    >
      <div className="flex items-center gap-2.5 border-b border-neutral-800 px-4 py-3">
        <Search size={15} className="shrink-0 text-neutral-500" />
        <input
          autoFocus
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setCursor(0)
          }}
          onKeyDown={handleKeyDown}
          placeholder="Search blocks and layouts…"
          aria-label="Search blocks and layouts"
          className="flex-1 bg-transparent text-sm text-neutral-100 outline-none placeholder:text-neutral-500"
        />
        <button
          onClick={onClose}
          aria-label="Close"
          className="text-neutral-500 transition-colors hover:text-neutral-100"
        >
          <X size={15} />
        </button>
      </div>

      <div className="flex gap-1 border-b border-neutral-800 px-3 pt-2" role="tablist">
        {(['blocks', 'layouts'] as const).map((key) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeTab === key}
            onClick={() => {
              setTab(key)
              setCursor(0)
            }}
            className={twMerge(
              'border-b-2 px-3 pb-2 pt-1 text-xs font-semibold capitalize transition-colors',
              activeTab === key
                ? 'border-[var(--studio-select)] text-neutral-100'
                : 'border-transparent text-neutral-500 hover:text-neutral-300'
            )}
          >
            {key}
          </button>
        ))}
      </div>

      <div ref={listRef} className="max-h-[52vh] overflow-y-auto p-2">
        {activeTab === 'blocks' ? (
          blocks.length === 0 ? (
            <p className="px-3 py-8 text-center text-xs text-neutral-500">Nothing matches that.</p>
          ) : (
            GROUP_ORDER.map((group) => {
              const inGroup = blocks.filter((b) => b.group === group)
              if (!inGroup.length) return null
              return (
                <section key={group}>
                  <h3 className="px-2 pb-1 pt-3 text-[10px] font-bold uppercase tracking-[0.14em] text-neutral-500">
                    {group}
                  </h3>
                  {inGroup.map((choice) => {
                    flat += 1
                    const index = flat
                    return (
                      <button
                        key={choice.id}
                        data-row
                        onMouseEnter={() => setCursor(index)}
                        onClick={() => commit(index)}
                        className={twMerge(
                          'flex w-full items-center gap-3 rounded-lg border px-2 py-2 text-left transition-colors',
                          index === cursorIndex
                            ? 'border-neutral-700 bg-neutral-800'
                            : 'border-transparent hover:bg-neutral-800/60'
                        )}
                      >
                        <span
                          className={twMerge(
                            'grid h-8 w-8 shrink-0 place-items-center rounded-md',
                            index === cursorIndex
                              ? 'bg-[var(--studio-select)] text-white'
                              : 'bg-neutral-800 text-neutral-300'
                          )}
                        >
                          {choice.icon}
                        </span>
                        <span className="min-w-0">
                          <span className="block text-sm font-medium text-neutral-100">
                            {choice.label}
                          </span>
                          <span className="block truncate text-[11px] text-neutral-500">
                            {choice.hint}
                          </span>
                        </span>
                      </button>
                    )
                  })}
                </section>
              )
            })
          )
        ) : layouts.length === 0 ? (
          <p className="px-3 py-8 text-center text-xs text-neutral-500">Nothing matches that.</p>
        ) : (
          <div className="grid grid-cols-2 gap-2 p-1">
            {layouts.map((tpl, index) => (
              <button
                key={tpl.id}
                data-row
                onMouseEnter={() => setCursor(index)}
                onClick={() => commit(index)}
                className={twMerge(
                  'flex flex-col gap-2 rounded-xl border bg-neutral-800/50 p-3 text-left transition-colors',
                  index === cursorIndex
                    ? 'border-[var(--studio-select)] bg-neutral-800'
                    : 'border-neutral-700 hover:border-neutral-600'
                )}
              >
                <span className="flex flex-col gap-1 rounded-md bg-neutral-950/60 p-2">
                  {tpl.blocks.slice(0, 4).map((b, i) => (
                    <span
                      key={i}
                      className="block rounded-[1px] bg-neutral-700"
                      style={{ height: b.type === 'image' ? 14 : b.type === 'divider' ? 1 : 4 }}
                    />
                  ))}
                </span>
                <span className="text-xs font-semibold text-neutral-100">{tpl.label}</span>
                <span className="text-[10px] leading-snug text-neutral-500">{tpl.description}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-neutral-800 px-4 py-2.5 text-[11px] text-neutral-500">
        <span>
          <Key>↑↓</Key> move
        </span>
        <span>
          <Key>↵</Key> insert
        </span>
        <span>
          <Key>tab</Key> switch
        </span>
        <span className="ml-auto">
          {activeTab === 'layouts' ? 'Layouts add a page — yours is untouched' : 'Media blocks start empty'}
        </span>
      </div>
    </Modal>
  )
}

function Key({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="rounded bg-neutral-800 px-1.5 py-0.5 font-sans text-[10px] font-semibold text-neutral-300">
      {children}
    </kbd>
  )
}
