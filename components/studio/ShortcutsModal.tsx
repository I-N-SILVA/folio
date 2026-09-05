'use client'

import { Modal } from '@/components/ui/Modal'
import { Command, Keyboard } from 'lucide-react'

interface ShortcutsModalProps {
  onClose: () => void
}

const SHORTCUT_GROUPS = [
  {
    category: 'Essential',
    shortcuts: [
      { keys: ['⌘', 'S'], desc: 'Force save edition' },
      { keys: ['⌘', 'Z'], desc: 'Undo last change' },
      { keys: ['⇧', '⌘', 'Z'], desc: 'Redo change' },
      { keys: ['⌘', 'P'], desc: 'Preview reader' },
      { keys: ['Esc'], desc: 'Deselect block or close modal' },
    ],
  },
  {
    category: 'Editing & Canvas',
    shortcuts: [
      { keys: ['⌫ / Del'], desc: 'Delete selected blocks or hotspot' },
      { keys: ['Click + Drag'], desc: 'Reposition hotspot or block' },
      { keys: ['?'], desc: 'Open keyboard shortcuts cheatsheet' },
    ],
  },
  {
    category: 'Selection & Clipboard',
    shortcuts: [
      { keys: ['⇧ / ⌘', 'Click'], desc: 'Add a block to the selection' },
      { keys: ['⌘', 'A'], desc: 'Select every block on the page' },
      { keys: ['⌘', 'C'], desc: 'Copy — works across editions' },
      { keys: ['⌘', 'X'], desc: 'Cut selected blocks' },
      { keys: ['⌘', 'V'], desc: 'Paste below the selection' },
      { keys: ['⌘', 'D'], desc: 'Duplicate selected blocks' },
    ],
  },
  {
    category: 'Reader & Navigation',
    shortcuts: [
      { keys: ['←', '→'], desc: 'Previous / Next page' },
      { keys: ['Space / Click'], desc: 'Flip page forward' },
      { keys: ['F'], desc: 'Toggle fullscreen mode' },
    ],
  },
]

export function ShortcutsModal({ onClose }: ShortcutsModalProps) {
  return (
    <Modal
      onClose={onClose}
      title="Keyboard Shortcuts"
      className="max-w-lg p-6 text-[var(--qlico-ink)]"
    >
      <div className="flex items-center gap-2.5 pb-2">
        <div className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--tint-weak)] text-[var(--qlico-ink)]">
          <Keyboard size={18} />
        </div>
        <div>
          <h2 className="font-display text-xl font-semibold tracking-[-0.02em]">
            Keyboard Shortcuts
          </h2>
          <p className="text-xs text-[var(--qlico-muted)]">Work faster with tactile hotkeys</p>
        </div>
      </div>

      <div className="mt-4 space-y-5">
        {SHORTCUT_GROUPS.map((group) => (
          <div key={group.category}>
            <h3 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--qlico-muted)]">
              {group.category}
            </h3>
            <div className="space-y-1.5 rounded-2xl border border-[var(--qlico-border)] bg-[var(--qlico-subtle)] p-3">
              {group.shortcuts.map((s, idx) => (
                <div key={idx} className="flex items-center justify-between py-1 text-xs">
                  <span className="font-medium text-[var(--qlico-ink)]">{s.desc}</span>
                  <div className="flex items-center gap-1">
                    {s.keys.map((k, kIdx) => (
                      <kbd
                        key={kIdx}
                        className="min-w-[22px] rounded-md border border-[var(--qlico-border)] bg-[var(--qlico-paper)] px-1.5 py-0.5 text-center font-mono text-[11px] font-semibold text-[var(--qlico-ink)] shadow-xs"
                      >
                        {k}
                      </kbd>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Modal>
  )
}
