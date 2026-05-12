'use client'

import { useState, useRef, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { useRouter } from 'next/navigation'
import { X, FileUp, Loader2 } from 'lucide-react'
import { toast } from 'sonner'

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

export function ImportPDFModal({ onClose }: ImportPDFModalProps) {
  const router = useRouter()
  const fileInputRef = useRef<HTMLInputElement>(null)

  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [status, setStatus] = useState<'idle' | 'uploading' | 'done'>('idle')
  const [statusMessage, setStatusMessage] = useState('')

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0] ?? null
    setFile(picked)
    if (picked && !title) {
      const derived = picked.name.replace(/\.pdf$/i, '')
      setTitle(derived)
      if (!slugEdited) {
        setSlug(slugify(derived))
      }
    }
  }, [title, slugEdited])

  const handleTitleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setTitle(e.target.value)
    if (!slugEdited) {
      setSlug(slugify(e.target.value))
    }
  }, [slugEdited])

  const handleSlugChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSlugEdited(true)
    setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))
  }, [])

  const handleDrop = useCallback((e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    const dropped = e.dataTransfer.files?.[0]
    if (dropped?.type === 'application/pdf' || dropped?.name.toLowerCase().endsWith('.pdf')) {
      setFile(dropped)
      if (!title) {
        const derived = dropped.name.replace(/\.pdf$/i, '')
        setTitle(derived)
        if (!slugEdited) {
          setSlug(slugify(derived))
        }
      }
    }
  }, [title, slugEdited])

  const handleSubmit = useCallback(async () => {
    if (!file || !title.trim() || !slug.trim()) return

    setStatus('uploading')
    setStatusMessage('Uploading PDF...')

    try {
      const form = new FormData()
      form.append('file', file)
      form.append('title', title.trim())
      form.append('slug', slug.trim())

      setStatusMessage('Processing pages... this may take a moment')

      const res = await fetch('/api/import/pdf', {
        method: 'POST',
        body: form,
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error ?? 'Import failed')
      }

      setStatus('done')
      setStatusMessage(`Done! ${data.pageCount} pages imported.`)

      toast.success(`"${title}" imported — ${data.pageCount} pages ready.`)
      onClose()
      router.push(`/editor/${data.bookId}`)
    } catch (err) {
      setStatus('idle')
      setStatusMessage('')
      toast.error((err as Error).message)
    }
  }, [file, title, slug, router, onClose])

  const isLoading = status === 'uploading'
  const canSubmit = !!file && title.trim().length > 0 && slug.trim().length > 0 && !isLoading

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
          onClick={isLoading ? undefined : onClose}
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
          {!isLoading && (
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
            Each page will be rendered as an image and added to a new book.
          </p>

          {/* Drop zone */}
          <div
            className={`border-2 border-dashed rounded-xl p-6 mb-5 text-center cursor-pointer transition-colors ${
              file
                ? 'border-[#01696F] bg-[#01696F]/5'
                : 'border-gray-200 hover:border-gray-300 bg-gray-50'
            }`}
            onClick={() => !isLoading && fileInputRef.current?.click()}
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={isLoading}
            />
            <FileUp
              size={24}
              className={`mx-auto mb-2 ${file ? 'text-[#01696F]' : 'text-gray-400'}`}
            />
            {file ? (
              <div>
                <p className="text-sm font-medium text-[#01696F] truncate px-2">{file.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">
                  {(file.size / 1024 / 1024).toFixed(1)} MB — click to change
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
              disabled={isLoading}
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
                disabled={isLoading}
                className="flex-1 py-2 pr-3 text-sm bg-transparent focus:outline-none disabled:opacity-50"
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">
              Lowercase letters, numbers, and hyphens only
            </p>
          </div>

          {/* Status message */}
          {statusMessage && (
            <div className="flex items-center gap-2 text-sm text-gray-600 mb-4">
              {isLoading && <Loader2 size={14} className="animate-spin text-[#01696F] flex-shrink-0" />}
              <span>{statusMessage}</span>
            </div>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3">
            <button
              onClick={isLoading ? undefined : onClose}
              disabled={isLoading}
              className="flex-1 py-2.5 rounded-lg border border-gray-200 text-sm font-medium text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              Cancel
            </button>
            <button
              onClick={handleSubmit}
              disabled={!canSubmit}
              className="flex-1 py-2.5 rounded-lg bg-[#01696F] text-white text-sm font-medium hover:opacity-90 transition-opacity disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  Importing...
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
