'use client'

import { useSyncExternalStore } from 'react'
import { Monitor, Moon, Sun } from 'lucide-react'
import { twMerge } from 'tailwind-merge'

export type ThemeChoice = 'light' | 'dark' | 'system'

export const THEME_STORAGE_KEY = 'qlico:theme'

/**
 * `system` is the default and stores nothing, so the page follows the OS via
 * the prefers-color-scheme block in globals.css. An explicit choice stamps
 * `data-theme` on <html>, which outranks that block in both directions.
 */
export function applyTheme(choice: ThemeChoice) {
  const root = document.documentElement
  if (choice === 'system') {
    root.removeAttribute('data-theme')
    try {
      localStorage.removeItem(THEME_STORAGE_KEY)
    } catch {
      // Private mode or blocked storage — the choice just won't persist.
    }
    return
  }
  root.setAttribute('data-theme', choice)
  try {
    localStorage.setItem(THEME_STORAGE_KEY, choice)
  } catch {
    // As above.
  }
}

function readTheme(): ThemeChoice {
  const attr = document.documentElement.getAttribute('data-theme')
  return attr === 'dark' || attr === 'light' ? attr : 'system'
}

/** The attribute is the source of truth, so watch it rather than mirror it. */
function subscribeToTheme(onChange: () => void) {
  const observer = new MutationObserver(onChange)
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  })
  return () => observer.disconnect()
}

const OPTIONS: { value: ThemeChoice; label: string; icon: React.ReactNode }[] = [
  { value: 'light', label: 'Light', icon: <Sun size={14} /> },
  { value: 'dark', label: 'Dark', icon: <Moon size={14} /> },
  { value: 'system', label: 'System', icon: <Monitor size={14} /> },
]

export function ThemeToggle({ className }: { className?: string }) {
  // Server-renders as `system`, which matches the pre-hydration script's
  // no-stored-choice case — anything else would mismatch.
  const current = useSyncExternalStore(subscribeToTheme, readTheme, () => 'system' as ThemeChoice)

  return (
    <div
      role="group"
      aria-label="Colour theme"
      className={twMerge(
        'flex items-center gap-0.5 rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)]/70 p-1',
        className
      )}
    >
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => applyTheme(option.value)}
          aria-pressed={current === option.value}
          title={option.label}
          className={twMerge(
            'grid h-7 w-7 place-items-center rounded-full transition-colors',
            current === option.value
              ? 'bg-[var(--accent)] text-[var(--accent-contrast)]'
              : 'text-[var(--qlico-muted)] hover:bg-[var(--tint)] hover:text-[var(--qlico-ink)]'
          )}
        >
          {option.icon}
          <span className="sr-only">{option.label}</span>
        </button>
      ))}
    </div>
  )
}
