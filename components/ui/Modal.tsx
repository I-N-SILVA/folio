'use client'

import { useCallback, useEffect, useId, useRef } from 'react'
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
} as const

const FOCUSABLE =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'

interface ModalProps {
  onClose: () => void
  /** Accessible name. Rendered as the visible heading unless `hideTitle`. */
  title: string
  hideTitle?: boolean
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
  hideTitle = false,
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

  // Return focus to whatever opened the dialog, so keyboard users don't get
  // dumped back at the top of the document on close.
  const openerRef = useRef<HTMLElement | null>(null)
  useEffect(() => {
    openerRef.current = document.activeElement as HTMLElement | null
    return () => openerRef.current?.focus?.()
  }, [])

  // Move focus into the panel on open.
  useEffect(() => {
    const panel = panelRef.current
    if (!panel) return
    const first = panel.querySelector<HTMLElement>(FOCUSABLE)
    ;(first ?? panel).focus({ preventScroll: true })
  }, [])

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

  // Portals need a DOM target, which doesn't exist during SSR.
  if (typeof document === 'undefined') return null

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
          'relative overflow-y-auto bg-white shadow-2xl outline-none',
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
            className="absolute right-3 top-3 z-10 grid h-8 w-8 place-items-center rounded-full text-current opacity-50 transition hover:bg-black/10 hover:opacity-100"
          >
            <X size={16} />
          </button>
        )}
        <h2 id={titleId} className={hideTitle ? 'sr-only' : undefined}>
          {hideTitle ? title : null}
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
      hideTitle
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
          className="rounded-full border border-[var(--qlico-border)] bg-white px-4 py-2.5 text-sm font-semibold transition hover:bg-[var(--qlico-subtle)] disabled:opacity-50"
        >
          {cancelLabel}
        </button>
        <button
          type="button"
          onClick={onConfirm}
          disabled={busy}
          className={twMerge(
            'rounded-full px-4 py-2.5 text-sm font-semibold text-white transition disabled:opacity-60',
            destructive
              ? 'bg-[#b3261e] hover:bg-[#8f1e18]'
              : 'bg-[var(--accent)] hover:bg-[var(--accent-hover)]'
          )}
        >
          {busy ? 'Working…' : confirmLabel}
        </button>
      </div>
    </Modal>
  )
}
