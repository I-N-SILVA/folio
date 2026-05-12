'use client'

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { X, FileUp, Loader2, CheckCircle2, AlertCircle } from 'lucide-react'
import { toast } from 'sonner'
import { renderPdfPages, type RenderProgress } from '@/lib/pdf-renderer'

interface ImportPDFModalProps {
  onClose: () => void
}

function slugify(value: string) {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
}

type Status = 'idle' | 'rendering' | 'uploading' | 'done' | 'error'

export function ImportPDFModal({ onClose }: ImportPDFModalProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [status, setStatus] = useState<Status>('idle')
  const [progress, setProgress] = useState<RenderProgress>({
    current: 0,
    total: 0,
    phase: 'loading',
  })
  const [errorMessage, setErrorMessage] = useState('')

  const handleFileChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const picked = e.target.files?.[0] ?? null
      setFile(picked)
      setErrorMessage('')
      if (picked && !title) {
        const derived = picked.name.replace(/\.pdf$/i, '')
        setTitle(derived)
        if (!slugEdited) {
          setSlug(slugify(derived))
        }
      }
    },
    [title, slugEdited]
  )

  const handleTitleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      setTitle(e.target.value)
      if (!slugEdited) {
        setSlug(slugify(e.target.value))
      }
    },
    [slugEdited]
  )

  const handleSlugChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugEdited(true)
    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }, [])

  const handleDrop = useCallback(
    (e: React.DragEvent<HTMLDivElement>) => {
      e.preventDefault()
      const dropped = e.dataTransfer.files?.[0]
      if (
        dropped?.type === 'application/pdf' ||
        dropped?.name.toLowerCase().endsWith('.pdf')
      ) {
        setFile(dropped)
        setErrorMessage('')
        if (!title) {
          const derived = dropped.name.replace(/\.pdf$/i, '')
          setTitle(derived)
          if (!slugEdited) {
            setSlug(slugify(derived))
          }
        }
      }
    },
    [title, slugEdited]
  )

  const handleSubmit = useCallback(async () => {
    if (!file || !title.trim() || !slug.trim()) return

    try {
      // ── Phase 1: Render PDF pages client-side ─────────────────────────
      setStatus('rendering')
      setErrorMessage('')

      const renderedPages = await renderPdfPages(file, {
        maxPages: 50,
        scale: 2,
        onProgress: setProgress,
      })

      // ── Phase 2: Upload everything ────────────────────────────────────
      setStatus('uploading')

      const form = new FormData()
      form.append('file', file)
      form.append('title', title.trim())
      form.append('slug', slug.trim())
      form.append('pageCount', renderedPages.length.toString())

      // Attach each rendered page as a separate file
      renderedPages.forEach((page, idx) => {
        form.append(
          `page_${idx}`,
          new File([page.blob], `page-${idx + 1}.png`, { type: 'image/png' })
        )
      })

      const res = await fetch('/api/import/pdf', {
        method: 'POST',
        body: form,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Import failed')
      }

      setStatus('done')
      toast.success(`"${title}" imported — ${data.pageCount} pages ready.`)

      // Brief delay so user sees the success state
      setTimeout(() => {
        onClose()
        router.push(`/editor/${data.bookId}`)
      }, 800)
    } catch (err) {
      setStatus('error')
      const msg = (err as Error).message
      setErrorMessage(msg)
      toast.error(msg)
    }
  }, [file, title, slug, router, onClose])

  const isWorking = status === 'rendering' || status === 'uploading'
  const canSubmit =
    !!file && title.trim().length > 0 && slug.trim().length > 0 && !isWorking && status !== 'done'

  // Progress percentage
  const pct =
    status === 'rendering' && progress.total > 0
      ? Math.round((progress.current / progress.total) * 100)
      : status === 'uploading'
        ? 100
        : 0

  return createPortal(
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-[9999] flex items-center justify-center p-4"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      >
        {/* Backdrop */}
        <div
          className="absolute inset-0 bg-black/60"
          onClick={isWorking || status === 'done' ? undefined : onClose}
        />

        {/* Dialog */}
        <motion.div
          className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
          initial={{ opacity: 0, scale: 0.95, y: 8 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 8 }}
          transition={{ type: 'spring', duration: 0.3 }}
          role="dialog"
          aria-modal="true"
          aria-label="Import PDF"
        >
          {/* Close */}
          {!isWorking && status !== 'done' && (
            <button
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700 transition-colors"
              onClick={onClose}
              aria-label="Close"
            >
              <X size={18} />
            </button>
          )}

          <h2 className="text-lg font-bold mb-1">Import PDF</h2>
          <p className="text-sm text-gray-500 mb-5">
            Each page will be rendered as a high-quality image and added to a new book.
          </p>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 mb-5 text-center transition-colors ${
              isWorking
                ? 'border-gray-200 bg-gray-50 cursor-default'
                : file
                  ? 'border-[#01696F] bg-[#01696F]/5 cursor-pointer'
                  : 'border-gray-200 hover:border-gray-300 bg-gray-50 cursor-pointer'
            }`}
            onClick={() => !isWorking && status !== 'done' && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={isWorking || status === 'done'}
            />
            <FileUp
              size={24}
              className={`mx-auto mb-2 ${file ? 'text-[#01696F]' : 'text-gray-400'}`}
            />
            {file ? (
              <div>
                <p className="text-sm font-medium text-[#01696F] truncate px-2">{file.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(file.size / 1024 / 1024).toFixed(1)} MB
                  {!isWorking && status !== 'done' && ' — click to change'}
                </p>
              </div>
            ) : (
              <div>
                <p className="text-sm text-gray-600 font-medium">
                  Drop a PDF here or click to browse
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Max 50 pages will be imported</p>
              </div>
            )}
          </div>

          {/* Title */}
          <div className="mb-4">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              Title
            </label>
            <input
              type="text"
              value={title}
              onChange={handleTitleChange}
              placeholder="My Book Title"
              disabled={isWorking || status === 'done'}
              className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#01696F]/30 focus:border-[#01696F] disabled:opacity-50 transition"
            />
          </div>

          {/* Slug */}
          <div className="mb-6">
            <label className="block text-xs font-medium text-gray-500 mb-1.5 uppercase tracking-wide">
              URL Slug
            </label>
            <div className="flex items-center border border-gray-200 rounded-lg focus-within:ring-2 focus-within:ring-[#01696F]/30 focus-within:border-[#01696F] transition">
              <span className="pl-3 text-xs text-gray-400 select-none whitespace-nowrap">
                /book/
              </span>
              <input
                type="text"
                value={slug}
                onChange={handleSlugChange}
                placeholder="my-book-title"
                disabled={isWorking || status === 'done'}
                className="flex-1 py-2 pr-3 text-sm bg-transparent focus:outline-none disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          {/* Progress bar */}
          {isWorking && (
            <div className="mb-5">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2 text-sm text-gray-600">
                  <Loader2 size={14} className="animate-spin text-[#01696F] flex-shrink-0" />
                  <span>
                    {status === 'rendering'
                      ? `Rendering page ${progress.current} of ${progress.total}…`
                      : 'Uploading to server…'}
                  </span>
                </div>
                <span className="text-xs text-gray-400 font-mono">{pct}%</span>
              </div>
              <div className="w-full h-1.5 bg-gray-100 rounded-full overflow-hidden">
                <motion.div
                  className="h-full bg-[#01696F] rounded-full"
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.3, ease: 'easeOut' }}
                />
              </div>
            </div>
          )}

          {/* Success state */}
          {status === 'done' && (
            <div className="flex items-center gap-2 text-sm text-emerald-600 mb-5">
              <CheckCircle2 size={16} />
              <span className="font-medium">Import complete — redirecting to editor…</span>
            </div>
          )}

          {/* Error state */}
          {status === 'error' && errorMessage && (
            <div className="flex items-start gap-2 text-sm text-red-600 mb-5 bg-red-50 p-3 rounded-lg">
              <AlertCircle size={16} className="flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={isWorking || status === 'done' ? undefined : onClose}
              disabled={isWorking || status === 'done'}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-lg bg-[#01696F] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isWorking ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  {status === 'rendering' ? 'Rendering…' : 'Uploading…'}
                </>
              ) : status === 'error' ? (
                <>
                  <FileUp size={14} />
                  Retry
                </>
              ) : (
                <>
                  <FileUp size={14} />
                  Import
                </>
              )}
            </button>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>,
    document.body
  )
}
