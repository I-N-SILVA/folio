'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { X, FileText, Layout, Image as ImageIcon, Upload, Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { ImportPDFModal } from './ImportPDFModal'
import { createBrowserSupabase } from '@/lib/supabase'

interface Props {
  onClose: () => void
}

export function CreateFolioModal({ onClose }: Props) {
  const [step, setStep] = useState<'choice' | 'pdf' | 'images'>('choice')
  const [loading, setLoading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const router = useRouter()
  const supabase = createBrowserSupabase()

  const handleCreateBlank = async () => {
    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const title = 'New Folio'
      const slug = `folio-${Math.random().toString(36).substring(7)}`

      const { data: book, error: bookError } = await supabase
        .from('books')
        .insert({
          title,
          slug,
          owner_id: user.id,
          settings: { published: false, theme: 'light' },
          theme: 'classic'
        })
        .select()
        .single()

      if (bookError) throw bookError

      // Create first page
      await supabase
        .from('pages')
        .insert({
          book_id: book.id,
          page_number: 1,
          type: 'content',
          layout: 'text',
          blocks: [],
          hotspots: []
        })

      router.push(`/editor/${book.id}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to create folio')
      setLoading(false)
    }
  }

  const handleBulkImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return

    setLoading(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      // 1. Create Book
      const title = 'Image Collection'
      const slug = `collection-${Math.random().toString(36).substring(7)}`

      const { data: book, error: bookError } = await supabase
        .from('books')
        .insert({
          title,
          slug,
          owner_id: user.id,
          settings: { published: false, theme: 'light' },
          theme: 'classic'
        })
        .select()
        .single()

      if (bookError) throw bookError

      // 2. Upload images and create pages
      for (let i = 0; i < files.length; i++) {
        const file = files[i]
        const ext = file.name.split('.').pop()
        const path = `${user.id}/${book.id}/page-${i + 1}-${Date.now()}.${ext}`

        const { error: uploadError } = await supabase.storage
          .from('folio-assets')
          .upload(path, file)

        if (uploadError) throw uploadError

        const { data: { publicUrl } } = supabase.storage
          .from('folio-assets')
          .getPublicUrl(path)

        await supabase
          .from('pages')
          .insert({
            book_id: book.id,
            page_number: i + 1,
            type: 'content',
            layout: 'image',
            background: publicUrl,
            blocks: [],
            hotspots: []
          })
      }

      router.push(`/editor/${book.id}`)
    } catch (err: any) {
      toast.error(err.message || 'Failed to upload images')
      setLoading(false)
    }
  }

  if (step === 'pdf') {
    return <ImportPDFModal onClose={onClose} />
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <h2 className="text-xl font-bold text-gray-900">Create New Folio</h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="p-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Blank option */}
            <button
              disabled={loading}
              onClick={handleCreateBlank}
              className="flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-gray-100 hover:border-[#01696F] hover:bg-[#01696F]/5 transition-all group text-center"
            >
              <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[#01696F] group-hover:text-white transition-colors">
                <Layout size={28} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Blank</h3>
                <p className="text-xs text-gray-500 mt-1">Start from scratch</p>
              </div>
            </button>

            {/* PDF option */}
            <button
              disabled={loading}
              onClick={() => setStep('pdf')}
              className="flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-gray-100 hover:border-[#01696F] hover:bg-[#01696F]/5 transition-all group text-center"
            >
              <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[#01696F] group-hover:text-white transition-colors">
                <FileText size={28} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">PDF</h3>
                <p className="text-xs text-gray-500 mt-1">Convert document</p>
              </div>
            </button>

            {/* Images option */}
            <button
              disabled={loading}
              onClick={() => fileInputRef.current?.click()}
              className="flex flex-col items-center gap-4 p-6 rounded-2xl border-2 border-gray-100 hover:border-[#01696F] hover:bg-[#01696F]/5 transition-all group text-center"
            >
              <div className="w-14 h-14 rounded-xl bg-gray-50 flex items-center justify-center text-gray-400 group-hover:bg-[#01696F] group-hover:text-white transition-colors">
                <ImageIcon size={28} />
              </div>
              <div>
                <h3 className="font-bold text-gray-900">Images</h3>
                <p className="text-xs text-gray-500 mt-1">Bulk upload</p>
              </div>
            </button>
          </div>

          <input
            type="file"
            multiple
            accept="image/*"
            ref={fileInputRef}
            onChange={handleBulkImageUpload}
            className="hidden"
          />

          {loading && (
            <div className="mt-8 flex items-center justify-center gap-3 text-sm text-[#01696F] font-medium animate-pulse">
              <Loader2 className="animate-spin" size={18} />
              Initializing your folio...
            </div>
          )}
        </div>

        <div className="bg-gray-50 p-6 flex items-center justify-center text-xs text-gray-400">
          Tip: PDFs are best for books, Images are best for portfolios.
        </div>
      </div>
    </div>
  )
}
