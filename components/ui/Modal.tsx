'use client'

import { useCallback, useEffect, useId, useRef, useSyncExternalStore } from 'react'
import { createPortal } from 'react-dom'
import { twMerge } from 'tailwind-merge'
import { X } from 'lucide-react'

/**
 * Every overlay in the app was hand-rolled: eight different backdrops, three
 * z-index scales (50 / 100 / 9999), and only two of them closed on Escape.
 * None trapped focus, so tabbing inside an open dialog walked straight into
 * the page behind it. This is the one primitive they all share now.
 */

/** Single source of truth for stacking, so overlays can't fight each other. */
export const Z = {
  /** Standard dialogs — block pickers, share sheets, settings. */
  modal: 200,
  /** Confirmations, which may open on top of a dialog. */
  confirm: 300,
  /**
   * Dialogs opened from inside the reader. The reader stacks its own chrome
   * high — the cover-open animation at 9500 and the badge at 9000 — so a hotspot
   * dialog has to clear both.
   */
  reader: 9800,
} as const

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

/** Capability/mount checks never change after load, but still need a subscriber. */
function subscribeToNothing() {
  return () => {}
}

interface ModalProps {
  onClose: () => void
  /**
   * Accessible name for the dialog. Rendered screen-reader-only — panels supply
   * their own visible heading, styled to their own surface.
   */
  title: string
  description?: string
  children: React.ReactNode
  /** Extra classes for the dialog panel. */
  className?: string
  /** Stacking level — bump to `Z.confirm` for a dialog over a dialog. */
  z?: number
  /** Clicking the backdrop closes by default. */
  dismissOnBackdrop?: boolean
  /** Hide the default close button when the panel supplies its own. */
  hideCloseButton?: boolean
  /**
   * `sheet` docks the panel to the bottom edge — the reachable-thumb position
   * on a phone, and how the editor surfaces its side panels on small screens.
   */
  variant?: 'center' | 'sheet'
}

export function Modal({
  onClose,
  title,
  description,
  children,
  className,
  z = Z.modal,
  dismissOnBackdrop = true,
  hideCloseButton = false,
  variant = 'center',
}: ModalProps) {
  const panelRef = useRef<HTMLDivElement>(null)
  const titleId = useId()
  const descId = useId()

  // A portal has nowhere to go during SSR, so the server renders nothing here.
  // Returning content on the very first client render would then mismatch what
  // was hydrated, and React's recovery re-render can leave a second portal
  // behind. Reporting "not mounted" for the hydration pass and flipping right
  // after keeps both sides agreeing.
  const mounted = useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  )

  // Return focus to whatever opened the dialog, so keyboard users don't get
  // dumped back at the top of the document on close.
  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null
    return () => openerRef.current?.focus?.()
  }, [])

  // Move focus into the panel on open. Waits for `mounted` — the panel only
  // exists from the post-hydration render onward.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const first = panel.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel).focus({ preventScroll: true })
  }, [mounted])

  // The page behind a dialog must not scroll.
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation()
        onClose()
        return
      }
      if (e.key !== 'Tab') return

      const panel = panelRef.current
      if (!panel) return
      const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
        (el) => el.offsetParent !== null || el === document.activeElement
      )
      if (items.length === 0) {
        e.preventDefault()
        return
      }
      const first = items[0]
      const last = items[items.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    },
    [onClose]
  )

  if (!mounted) return null

  return createPortal(
    <div
      className={twMerge(
        'fixed inset-0 flex justify-center',
        variant === 'sheet' ? 'items-end' : 'items-center p-4'
      )}
      style={{ zIndex: z }}
      onKeyDown={handleKeyDown}
    >
      <div
        className="absolute inset-0 bg-[#0b0d1a]/60 backdrop-blur-sm"
        onClick={dismissOnBackdrop ? onClose : undefined}
        aria-hidden="true"
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={twMerge(
          'relative overflow-y-auto bg-[var(--qlico-paper)] shadow-2xl outline-none',
          variant === 'sheet'
            ? 'max-h-[82vh] w-full rounded-t-2xl pb-[env(safe-area-inset-bottom)]'
            : 'max-h-[90vh] w-full max-w-md rounded-2xl',
          className
        )}
      >
        {!hideCloseButton && (
          <button
            type="button"
            onClick={onClose}
            aria-label="Close dialog"
            className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-current opacity-50 transition hover:bg-[var(--tint)] hover:opacity-100"
          >
            <X size={16} />
          </button>
        )}
        {/* Always rendered, always the accessible name. This used to be empty
            whenever `hideTitle` was false — the title text was only written into
            it in the hidden case — so every dialog that supplied its own visible
            heading pointed `aria-labelledby` at an empty element and announced
            itself as an unnamed dialog. Panels render their own heading for the
            eye; this one is for the screen reader, so it stays hidden either
            way. */}
        <h2 id={titleId} className="sr-only">
          {title}
        </h2>
        {description && (
          <p id={descId} className="sr-only">
            {description}
          </p>
        )}
        {children}
      </div>
    </div>,
    document.body
  )
}

interface ConfirmDialogProps {
  title: string
  /** What the user is about to do, in plain language. */
  body: React.ReactNode
  confirmLabel?: string
  cancelLabel?: string
  /** Red-styles the confirm button for deletes and other one-way doors. */
  destructive?: boolean
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Replaces `window.confirm`, which can't be styled, can't be branded, and is
 * suppressible by the browser — a bad fit for a destructive action.
 */
export function ConfirmDialog({
  title,
  body,
  confirmLabel = 'Confirm',
  cancelLabel = 'Cancel',
  destructive = false,
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  return (
    <Modal
      onClose={busy ? () => {} : onCancel}
      title={title}
      z={Z.confirm}
      hideCloseButton
      dismissOnBackdrop={!busy}
      className="max-w-sm p-6 text-[var(--qlico-ink)]"
    >
      <h3 className="font-display text-2xl font-semibold tracking-[-0.03em]">{title}</h3>
      <div className="mt-2 text-sm leading-6 text-[var(--qlico-muted)]">{body}</div>
      <div className="mt-6 flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          disabled={busy}
          className="rounded-full border border-[var(--qlico-border)] bg-[var(--qlico-paper)] px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--qlico-subtle)] disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={twMerge(
            'rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:opacity-60',
            destructive
              ? 'bg-[#b3261e] text-white hover:bg-[#8f1e18]'
              : 'bg-[var(--accent)] text-[var(--accent-contrast)] hover:bg-[var(--accent-hover)] shadow-sm'
          )}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
