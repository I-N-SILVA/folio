'use client'

import { AlertTriangle, Check, Info } from 'lucide-react'
import { twMerge } from 'tailwind-merge'
import { Modal } from '@/components/ui/Modal'
import { useEditorStore } from '@/lib/editor-store'
import { countBlockers, type PublishIssue } from '@/lib/publish-checks'

/**
 * The last look before a link goes out.
 *
 * Publishing used to flip a boolean. Nothing checked whether the edition held a
 * button pointing at `https://example.com`, an image with no alt text, or an
 * email gate set to page 9 of a 6-page edition — all of which are invisible in
 * the editor and obvious to the first person who opens the link.
 *
 * It explains rather than refuses. An author who wants to publish an unfinished
 * edition has a reason, and a tool that blocks them outright gets worked around;
 * one that says what will be wrong gets read.
 */
export function PublishChecklistModal({
  issues,
  onConfirm,
  onClose,
}: {
  issues: PublishIssue[]
  onConfirm: () => void
  onClose: () => void
}) {
  const blockers = countBlockers(issues)
  const warnings = issues.length - blockers
  const setCurrentPageIndex = useEditorStore((s) => s.setCurrentPageIndex)
  const selectBlock = useEditorStore((s) => s.selectBlock)

  function goTo(issue: PublishIssue) {
    if (issue.pageNumber == null) return
    setCurrentPageIndex(issue.pageNumber - 1)
    if (issue.blockId) selectBlock(issue.blockId)
    onClose()
  }

  return (
    <Modal
      onClose={onClose}
      title="Before you publish"
      className="w-[520px] max-w-[calc(100vw-2rem)] overflow-hidden border border-studio-line-strong bg-studio-panel p-0"
    >
      <div className="border-b border-studio-line px-5 py-4">
        <h2 className="text-base font-semibold text-studio-ink">
          {issues.length === 0 ? 'Ready to publish' : 'Before you publish'}
        </h2>
        <p className="mt-1 text-xs text-studio-ink-soft">
          {issues.length === 0
            ? 'Nothing looks unfinished. This will be live at your link straight away.'
            : `${blockers > 0 ? `${blockers} thing${blockers === 1 ? '' : 's'} to fix` : 'Nothing blocking'}${
                warnings > 0 ? `, ${warnings} worth a look` : ''
              }. Click any of them to jump there.`}
        </p>
      </div>

      {issues.length > 0 && (
        <ul className="max-h-[46vh] divide-y divide-studio-line/70 overflow-y-auto">
          {issues.map((issue) => (
            <li key={issue.id}>
              <button
                type="button"
                onClick={() => goTo(issue)}
                disabled={issue.pageNumber == null}
                className={twMerge(
                  'flex w-full items-start gap-3 px-5 py-3 text-left transition-colors',
                  issue.pageNumber != null ? 'hover:bg-studio-raised/60' : 'cursor-default'
                )}
              >
                <span
                  className={twMerge(
                    'mt-0.5 shrink-0',
                    issue.severity === 'blocker' ? 'text-amber-400' : 'text-studio-ink-soft'
                  )}
                >
                  {issue.severity === 'blocker' ? <AlertTriangle size={15} /> : <Info size={15} />}
                </span>
                <span className="min-w-0">
                  <span className="block text-[13px] font-medium text-studio-ink">
                    {issue.title}
                  </span>
                  <span className="block text-[11.5px] leading-4 text-studio-ink-soft">
                    {issue.detail}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}

      {issues.length === 0 && (
        <div className="flex items-center gap-3 px-5 py-7 text-emerald-400">
          <Check size={20} />
          <span className="text-sm text-studio-ink">
            Every block has what it needs, and the gate lands on a page that exists.
          </span>
        </div>
      )}

      <div className="flex items-center justify-end gap-2 border-t border-studio-line px-5 py-3.5">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-studio-line-strong bg-studio-raised px-3.5 py-2 text-xs font-semibold text-studio-ink transition-colors hover:bg-studio-raised-2"
        >
          Keep editing
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="rounded-md bg-emerald-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-emerald-700"
        >
          {blockers > 0 ? 'Publish anyway' : 'Publish'}
        </button>
      </div>
    </Modal>
  )
}
