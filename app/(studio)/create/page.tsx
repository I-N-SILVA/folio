'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { THEME_PRESETS } from '@/lib/book-schema'

type Step = 1 | 2 | 3

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 100)
}

export default function CreatePage() {
  const router = useRouter()
  const [step, setStep] = useState<Step>(1)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [slug, setSlug] = useState('')
  const [slugEdited, setSlugEdited] = useState(false)
  const [theme, setTheme] = useState<keyof typeof THEME_PRESETS>('ivory')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  function handleTitleChange(val: string) {
    setTitle(val)
    if (!slugEdited) setSlug(slugify(val))
  }

  async function handleCreate() {
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/books', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, slug, theme: { preset: theme } }),
      })
      if (!res.ok) {
        const data = await res.json()
        setError(data.error ?? 'Something went wrong')
        setLoading(false)
        return
      }
      const book = await res.json()
      router.push(`/editor/${book.id}`)
    } catch {
      setError('Network error')
      setLoading(false)
    }
  }

  return (
    <main className="min-h-screen bg-[#F7F6F2] flex items-center justify-center p-8">
      <div className="w-full max-w-lg bg-white rounded-2xl p-8 shadow-sm">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {([1, 2, 3] as const).map((s) => (
            <div
              key={s}
              className={`flex-1 h-1.5 rounded-full transition-colors ${s <= step ? 'bg-[#01696F]' : 'bg-gray-100'}`}
            />
          ))}
        </div>

        {step === 1 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold mb-1">Book details</h2>
              <p className="text-sm text-gray-500">Give your book a title and a URL slug.</p>
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Title *</label>
              <input
                type="text"
                value={title}
                onChange={(e) => handleTitleChange(e.target.value)}
                placeholder="My Interactive Book"
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#01696F]"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="What's this book about?"
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#01696F] resize-none"
              />
            </div>

            <div>
              <label className="block text-sm font-medium mb-1">URL slug *</label>
              <div className="flex items-center border border-gray-200 rounded-lg overflow-hidden focus-within:ring-2 focus-within:ring-[#01696F]">
                <span className="px-3 py-2.5 text-sm text-gray-400 bg-gray-50 border-r border-gray-200">
                  /book/
                </span>
                <input
                  type="text"
                  value={slug}
                  onChange={(e) => { setSlug(e.target.value); setSlugEdited(true) }}
                  placeholder="my-book"
                  className="flex-1 px-3 py-2.5 text-sm focus:outline-none"
                />
              </div>
            </div>

            <button
              onClick={() => setStep(2)}
              disabled={!title || !slug}
              className="bg-[#01696F] text-white rounded-lg py-3 font-medium hover:opacity-90 transition-opacity disabled:opacity-40"
            >
              Next: Choose Theme →
            </button>
          </div>
        )}

        {step === 2 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold mb-1">Pick a theme</h2>
              <p className="text-sm text-gray-500">Sets your book's colors and typography.</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {(Object.entries(THEME_PRESETS) as [keyof typeof THEME_PRESETS, typeof THEME_PRESETS[keyof typeof THEME_PRESETS]][]).map(([key, preset]) => (
                <button
                  key={key}
                  onClick={() => setTheme(key)}
                  className={`flex items-center gap-4 p-4 rounded-xl border-2 text-left transition-all ${
                    theme === key ? 'border-[#01696F]' : 'border-gray-100 hover:border-gray-200'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-lg flex-shrink-0"
                    style={{ backgroundColor: preset.background, border: '1px solid rgba(0,0,0,0.1)' }}
                  />
                  <div>
                    <p className="font-medium text-sm">{preset.label}</p>
                    <p className="text-xs text-gray-400">{preset.headingFont} · {preset.bodyFont}</p>
                  </div>
                  <div
                    className="ml-auto w-4 h-4 rounded-full flex-shrink-0"
                    style={{ backgroundColor: preset.primary }}
                  />
                </button>
              ))}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setStep(1)}
                className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-3 font-medium hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={() => setStep(3)}
                className="flex-1 bg-[#01696F] text-white rounded-lg py-3 font-medium hover:opacity-90 transition-opacity"
              >
                Next: Review →
              </button>
            </div>
          </div>
        )}

        {step === 3 && (
          <div className="flex flex-col gap-5">
            <div>
              <h2 className="text-xl font-bold mb-1">Ready to create</h2>
              <p className="text-sm text-gray-500">Review your settings before creating.</p>
            </div>

            <div className="bg-gray-50 rounded-xl p-4 space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-500">Title</span>
                <span className="font-medium">{title}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Slug</span>
                <span className="font-mono text-xs bg-gray-200 px-2 py-0.5 rounded">/book/{slug}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Theme</span>
                <span className="font-medium">{THEME_PRESETS[theme].label}</span>
              </div>
            </div>

            {error && <p className="text-red-600 text-sm">{error}</p>}

            <div className="flex gap-3">
              <button
                onClick={() => setStep(2)}
                className="flex-1 border border-gray-200 text-gray-700 rounded-lg py-3 font-medium hover:bg-gray-50 transition-colors"
              >
                ← Back
              </button>
              <button
                onClick={handleCreate}
                disabled={loading}
                className="flex-1 bg-[#01696F] text-white rounded-lg py-3 font-medium hover:opacity-90 transition-opacity disabled:opacity-50"
              >
                {loading ? 'Creating…' : 'Create Book'}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  )
}
