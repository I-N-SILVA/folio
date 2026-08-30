'use client'

import { useState } from 'react'
import { Modal } from '@/components/ui/Modal'
import { Search, FolderOpen, X, Check, Image as ImageIcon, Layers } from 'lucide-react'

export interface CuratedAsset {
  id: string
  title: string
  category: 'Fashion & Luxury' | 'Architecture & Design' | 'Gastronomy & Wine' | 'Editorial & Gradients' | 'Paper Textures'
  url: string
  thumbnailUrl: string
  author: string
  authorUrl?: string
}

export const CURATED_ASSETS: CuratedAsset[] = [
  // Fashion & Luxury
  {
    id: 'f-1',
    title: 'Minimalist Silk Fabric Fold',
    category: 'Fashion & Luxury',
    url: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1558769132-cb1aea458c5e?auto=format&fit=crop&w=500&q=75',
    author: 'Elena Koycheva',
  },
  {
    id: 'f-2',
    title: 'Milan Runway Trench Editorial',
    category: 'Fashion & Luxury',
    url: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1490481651871-ab68de25d43d?auto=format&fit=crop&w=500&q=75',
    author: 'Flaunter',
  },
  {
    id: 'f-3',
    title: 'Luxury Leather Bag Detail',
    category: 'Fashion & Luxury',
    url: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?auto=format&fit=crop&w=500&q=75',
    author: 'Creative Exchange',
  },
  {
    id: 'f-4',
    title: 'High Horology Chronograph',
    category: 'Fashion & Luxury',
    url: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1522335789203-aabd1fc54bc9?auto=format&fit=crop&w=500&q=75',
    author: 'Jaelynn Castillo',
  },

  // Architecture & Design
  {
    id: 'a-1',
    title: 'Kyoto Pavilion Raw Concrete & Wood',
    category: 'Architecture & Design',
    url: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=500&q=75',
    author: 'R ARCHITECTURE',
  },
  {
    id: 'a-2',
    title: 'Minimalist Slate Cantilever',
    category: 'Architecture & Design',
    url: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=500&q=75',
    author: 'Ronnie George',
  },
  {
    id: 'a-3',
    title: 'Charred Timber Screen & Bamboo',
    category: 'Architecture & Design',
    url: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1513694203232-719a280e022f?auto=format&fit=crop&w=500&q=75',
    author: 'Samson Bush',
  },

  // Gastronomy & Wine
  {
    id: 'g-1',
    title: 'Degustation Langoustine Plating',
    category: 'Gastronomy & Wine',
    url: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1555396273-367ea4eb4db5?auto=format&fit=crop&w=500&q=75',
    author: 'Jay Wennington',
  },
  {
    id: 'g-2',
    title: 'Sommelier Reserve Wine Cellar',
    category: 'Gastronomy & Wine',
    url: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1510812431401-41d2bd2722f3?auto=format&fit=crop&w=500&q=75',
    author: 'Kym Ellis',
  },

  // Editorial & Gradients
  {
    id: 'e-1',
    title: 'Deep Obsidian Dark Studio Gradient',
    category: 'Editorial & Gradients',
    url: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?auto=format&fit=crop&w=500&q=75',
    author: 'Milad Fakurian',
  },
  {
    id: 'e-2',
    title: 'Emerald Prismatic Wave',
    category: 'Editorial & Gradients',
    url: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1579783902614-a3fb3927b675?auto=format&fit=crop&w=500&q=75',
    author: 'Steve Johnson',
  },

  // Paper Textures
  {
    id: 'p-1',
    title: 'Japanese Mulberry Washi Paper',
    category: 'Paper Textures',
    url: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1607604276583-eef5d076aa5f?auto=format&fit=crop&w=500&q=75',
    author: 'Kseniya Lapteva',
  },
  {
    id: 'p-2',
    title: 'Charcoal Pressed Linen Grain',
    category: 'Paper Textures',
    url: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1586075010923-2dd4570fb338?auto=format&fit=crop&w=500&q=75',
    author: 'Annie Spratt',
  },
  {
    id: 'p-3',
    title: 'Ivory Matte Card Stock',
    category: 'Paper Textures',
    url: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=1600&q=85',
    thumbnailUrl: 'https://images.unsplash.com/photo-1589829085413-56de8ae18c73?auto=format&fit=crop&w=500&q=75',
    author: 'Scott Graham',
  },
]

interface AssetLibraryModalProps {
  isOpen: boolean
  onClose: () => void
  onSelect: (url: string, alt: string) => void
  initialCategory?: string
}

export function AssetLibraryModal({
  isOpen,
  onClose,
  onSelect,
  initialCategory = 'All',
}: AssetLibraryModalProps) {
  const [selectedCategory, setSelectedCategory] = useState<string>(initialCategory)
  const [searchQuery, setSearchQuery] = useState<string>('')

  if (!isOpen) return null

  const categories = [
    'All',
    'Fashion & Luxury',
    'Architecture & Design',
    'Gastronomy & Wine',
    'Editorial & Gradients',
    'Paper Textures',
  ]

  const filtered = CURATED_ASSETS.filter((asset) => {
    const matchesCat = selectedCategory === 'All' || asset.category === selectedCategory
    const matchesQuery =
      !searchQuery.trim() ||
      asset.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
      asset.category.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesCat && matchesQuery
  })

  return (
    <Modal
      onClose={onClose}
      title="High-Res Asset & Texture Library"
      className="max-w-4xl w-full rounded-2xl border border-neutral-800 bg-neutral-950 p-6 text-neutral-100 max-h-[85vh] flex flex-col"
    >
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4 shrink-0">
        <div>
          <div className="flex items-center gap-2">
            <FolderOpen size={16} className="text-neutral-300" />
            <h2 className="font-display text-xl font-bold tracking-tight text-white">
              Curated Asset & Texture Library
            </h2>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            Editorial photography, tactile paper textures, and luxury backgrounds ready to insert.
          </p>
        </div>
        <button
          onClick={onClose}
          className="rounded-full p-2 text-neutral-400 hover:bg-neutral-900 hover:text-white transition"
        >
          <X size={18} />
        </button>
      </div>

      {/* Search & Category Filter Bar */}
      <div className="pt-4 pb-3 space-y-3 shrink-0">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search fashion, architecture, washi paper, linen, textures..."
            className="w-full bg-neutral-900 border border-neutral-800 rounded-xl pl-9 pr-4 py-2 text-xs text-neutral-100 placeholder-neutral-500 outline-none focus:border-neutral-600"
          />
        </div>

        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-0.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap transition ${
                selectedCategory === cat
                  ? 'bg-white text-black font-bold'
                  : 'bg-neutral-900 text-neutral-400 hover:text-neutral-200 border border-neutral-800'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Asset Grid */}
      <div className="flex-1 overflow-y-auto pr-1 py-2 custom-scrollbar">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center text-neutral-500">
            <ImageIcon size={32} className="mb-2 opacity-40" />
            <p className="text-sm font-medium">No assets matching &ldquo;{searchQuery}&rdquo;</p>
            <p className="text-xs text-neutral-600 mt-1">Try searching for silk, concrete, or paper.</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {filtered.map((asset) => (
              <div
                key={asset.id}
                onClick={() => {
                  onSelect(asset.url, asset.title)
                  onClose()
                }}
                className="group relative cursor-pointer overflow-hidden rounded-xl border border-neutral-800 bg-neutral-900/60 transition hover:border-[var(--accent-vivid)] hover:shadow-xl flex flex-col"
              >
                <div className="relative aspect-[4/3] w-full overflow-hidden bg-neutral-950">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={asset.thumbnailUrl}
                    alt={asset.title}
                    className="h-full w-full object-cover transition-transform duration-500 group-hover:scale-105"
                    loading="lazy"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end p-2">
                    <span className="flex items-center gap-1 rounded-full bg-white text-black px-2 py-0.5 text-[10px] font-bold shadow">
                      <Check size={10} strokeWidth={3} />
                      Insert
                    </span>
                  </div>
                </div>

                <div className="p-2.5">
                  <p className="text-xs font-semibold text-neutral-200 truncate">{asset.title}</p>
                  <p className="text-[10px] text-neutral-500 truncate mt-0.5">
                    {asset.category} · {asset.author}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Modal>
  )
}
