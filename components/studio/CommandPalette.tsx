'use client'

import { useEffect, useState, useMemo } from 'react'
import { Modal } from '@/components/ui/Modal'
import {
  Search,
  Layers,
  Plus,
  Type,
  Image,
  Video,
  Music,
  Crosshair,
  Eye,
  Share2,
  Palette,
  Grid3X3,
  Check,
  Layout,
} from 'lucide-react'
import { useEditorStore } from '@/lib/editor-store'
import type { Block } from '@/lib/book-schema'

interface CommandItem {
  id: string
  title: string
  category: 'Navigation' | 'Insert Block' | 'Page Layout' | 'Themes & Styling' | 'Actions'
  icon: React.ReactNode
  shortcut?: string
  action: () => void
}

interface CommandPaletteProps {
  isOpen: boolean
  onClose: () => void
  onOpenPreview: () => void
  onOpenShare: () => void
  onToggleGuides: () => void
  onAutoDetectPins: () => void
  onOpenAssetLibrary?: () => void
}

export function CommandPalette({
  isOpen,
  onClose,
  onOpenPreview,
  onOpenShare,
  onToggleGuides,
  onAutoDetectPins,
  onOpenAssetLibrary,
}: CommandPaletteProps) {
  const { book, currentPageIndex, setCurrentPageIndex, addBlock, updatePage, updateTheme, setHotspotMode } =
    useEditorStore()
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)

  const currentPage = book?.pages?.[currentPageIndex]

  const commands: CommandItem[] = useMemo(() => {
    if (!book) return []
    const items: CommandItem[] = []

    // Navigation: Go to pages
    book.pages?.forEach((p, idx) => {
      items.push({
        id: `nav-page-${p.id}`,
        title: `Go to Page ${p.page_number} (${p.type})`,
        category: 'Navigation',
        icon: <Layers size={14} />,
        shortcut: `p${p.page_number}`,
        action: () => {
          setCurrentPageIndex(idx)
          onClose()
        },
      })
    })

    // Insert Blocks
    if (currentPage) {
      items.push(
        {
          id: 'insert-text-heading',
          title: 'Insert Heading Text',
          category: 'Insert Block',
          icon: <Type size={14} />,
          action: () => {
            addBlock(currentPage.id, {
              id: crypto.randomUUID(),
              type: 'text',
              variant: 'heading',
              content: 'Section Heading',
              align: 'left',
            })
            onClose()
          },
        },
        {
          id: 'insert-text-body',
          title: 'Insert Body Paragraph',
          category: 'Insert Block',
          icon: <Type size={14} />,
          action: () => {
            addBlock(currentPage.id, {
              id: crypto.randomUUID(),
              type: 'text',
              variant: 'body',
              content: 'Add your editorial copy here...',
              align: 'left',
            })
            onClose()
          },
        },
        {
          id: 'insert-image',
          title: 'Insert High-Res Image / Photo',
          category: 'Insert Block',
          icon: <Image size={14} />,
          action: () => {
            if (onOpenAssetLibrary) {
              onOpenAssetLibrary()
            } else {
              addBlock(currentPage.id, {
                id: crypto.randomUUID(),
                type: 'image',
                src: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1200&q=80',
                alt: '',
                lightbox: true,
              })
            }
            onClose()
          },
        },
        {
          id: 'insert-hotspot',
          title: 'Arm Hotspot Placement Tool',
          category: 'Insert Block',
          icon: <Crosshair size={14} />,
          shortcut: 'H',
          action: () => {
            setHotspotMode(true)
            onClose()
          },
        },
        {
          id: 'insert-button',
          title: 'Insert Call-to-Action Button',
          category: 'Insert Block',
          icon: <Plus size={14} />,
          action: () => {
            addBlock(currentPage.id, {
              id: crypto.randomUUID(),
              type: 'button',
              label: 'Explore Collection →',
              href: 'https://qlico.app',
              variant: 'primary',
              target: '_blank',
            })
            onClose()
          },
        }
      )

      // Layout Switcher
      items.push(
        {
          id: 'layout-hero',
          title: 'Switch Page to Hero Layout',
          category: 'Page Layout',
          icon: <Layout size={14} />,
          action: () => {
            updatePage(currentPage.id, { layout: 'hero' })
            onClose()
          },
        },
        {
          id: 'layout-split',
          title: 'Switch Page to Split 50/50 Layout',
          category: 'Page Layout',
          icon: <Layout size={14} />,
          action: () => {
            updatePage(currentPage.id, { layout: 'split' })
            onClose()
          },
        }
      )
    }

    // Actions & Tools
    items.push(
      {
        id: 'action-preview',
        title: 'Open Live Interactive Reader Preview',
        category: 'Actions',
        icon: <Eye size={14} />,
        shortcut: 'Cmd+P',
        action: () => {
          onOpenPreview()
          onClose()
        },
      },
      {
        id: 'action-share',
        title: 'Share & Publish Edition',
        category: 'Actions',
        icon: <Share2 size={14} />,
        action: () => {
          onOpenShare()
          onClose()
        },
      },
      {
        id: 'action-guides',
        title: 'Toggle Alignment & Grid Guidelines',
        category: 'Actions',
        icon: <Grid3X3 size={14} />,
        action: () => {
          onToggleGuides()
          onClose()
        },
      },
      {
        id: 'action-ai-pins',
        title: 'Auto-Detect Interactive Product Pins',
        category: 'Actions',
        icon: <Crosshair size={14} />,
        action: () => {
          onAutoDetectPins()
          onClose()
        },
      }
    )

    // Theme Switcher
    ;(['carbon', 'ivory', 'slate', 'cream', 'sage'] as const).forEach((preset) => {
      items.push({
        id: `theme-${preset}`,
        title: `Apply Theme: ${preset.toUpperCase()}`,
        category: 'Themes & Styling',
        icon: <Palette size={14} />,
        action: () => {
          updateTheme({ preset })
          onClose()
        },
      })
    })

    return items
  }, [book, currentPage, setCurrentPageIndex, addBlock, setHotspotMode, updatePage, updateTheme, onClose, onOpenPreview, onOpenShare, onToggleGuides, onAutoDetectPins, onOpenAssetLibrary])

  const filtered = useMemo(() => {
    if (!query.trim()) return commands
    return commands.filter(
      (c) =>
        c.title.toLowerCase().includes(query.toLowerCase()) ||
        c.category.toLowerCase().includes(query.toLowerCase()) ||
        c.shortcut?.toLowerCase().includes(query.toLowerCase())
    )
  }, [commands, query])

  useEffect(() => {
    setSelectedIndex(0)
  }, [query])

  useEffect(() => {
    if (!isOpen) {
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  if (!isOpen) return null

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filtered.length))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex((prev) => (prev - 1 + filtered.length) % Math.max(1, filtered.length))
    } else if (e.key === 'Enter' && filtered[selectedIndex]) {
      e.preventDefault()
      filtered[selectedIndex].action()
    }
  }

  return (
    <Modal
      onClose={onClose}
      title="Command Palette"
      hideCloseButton
      className="max-w-xl w-full rounded-2xl border border-neutral-800 bg-neutral-950 p-0 text-neutral-100 shadow-2xl overflow-hidden"
    >
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-neutral-800">
        <Search size={16} className="text-neutral-400 shrink-0" />
        <input
          autoFocus
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command, page number, or block name..."
          className="w-full bg-transparent text-sm text-neutral-100 placeholder-neutral-500 outline-none"
        />
        <span className="rounded border border-neutral-800 bg-neutral-900 px-1.5 py-0.5 text-[10px] font-mono text-neutral-400">
          ESC
        </span>
      </div>

      <div className="max-h-[340px] overflow-y-auto p-2 custom-scrollbar space-y-1">
        {filtered.length === 0 ? (
          <div className="py-8 text-center text-xs text-neutral-500">
            No commands matching &ldquo;{query}&rdquo;
          </div>
        ) : (
          filtered.map((item, idx) => (
            <button
              key={item.id}
              onClick={item.action}
              onMouseEnter={() => setSelectedIndex(idx)}
              className={`flex items-center justify-between w-full px-3 py-2 rounded-xl text-left transition text-xs ${
                selectedIndex === idx
                  ? 'bg-white text-black font-semibold shadow'
                  : 'text-neutral-300 hover:bg-neutral-900'
              }`}
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span className={selectedIndex === idx ? 'text-black' : 'text-neutral-400'}>
                  {item.icon}
                </span>
                <span className="truncate">{item.title}</span>
              </div>

              <div className="flex items-center gap-2 shrink-0 ml-2">
                <span
                  className={`text-[10px] uppercase font-mono tracking-wider ${
                    selectedIndex === idx ? 'text-neutral-700' : 'text-neutral-500'
                  }`}
                >
                  {item.category}
                </span>
                {item.shortcut && (
                  <span
                    className={`rounded px-1.5 py-0.5 text-[10px] font-mono ${
                      selectedIndex === idx
                        ? 'bg-neutral-200 text-black'
                        : 'border border-neutral-800 bg-neutral-900 text-neutral-400'
                    }`}
                  >
                    {item.shortcut}
                  </span>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-neutral-800/80 bg-neutral-950 text-[10px] text-neutral-500">
        <span>Use ↑ ↓ to navigate</span>
        <span>Press ↵ to run command</span>
      </div>
    </Modal>
  )
}
