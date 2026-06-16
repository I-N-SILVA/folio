'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import * as Lucide from 'lucide-react'
import { useEditorStore } from '@/lib/editor-store'
import type {
  Block,
  Page,
  Hotspot,
  TextBlock,
  ImageBlock,
  VideoBlock,
  AudioBlock,
  ButtonBlock,
  EmbedBlock,
  DataBlock,
} from '@/lib/book-schema'

// ─── Shared form field primitives ────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-[11px] font-medium text-neutral-400 uppercase tracking-wider">
        {label}
      </label>
      {children}
    </div>
  )
}

const inputCls =
  'bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-neutral-500 w-full'

const selectCls =
  'bg-neutral-800 border border-neutral-700 rounded px-2 py-1.5 text-sm text-neutral-100 outline-none focus:border-neutral-500 w-full'

// ─── Icon picker ──────────────────────────────────────────────────────────────

const HOTSPOT_ICONS = [
  'Info', 'Star', 'Zap', 'Sparkles', 'BookOpen', 'BarChart2', 'Play', 'Link',
  'ShoppingBag', 'ShoppingCart', 'Tag', 'Gift', 'Heart', 'MapPin', 'Quote', 'Pencil',
]

function IconPicker({ value, onChange }: { value?: string; onChange: (name: string) => void }) {
  return (
    <div className="grid grid-cols-8 gap-1.5">
      {HOTSPOT_ICONS.map((name) => {
        const Ic = (Lucide as any)[name] ?? Lucide.Info
        const active = value === name
        return (
          <button
            type="button"
            key={name}
            title={name}
            onClick={() => onChange(name)}
            className={twMerge(
              'flex aspect-square items-center justify-center rounded-md border transition-colors',
              active
                ? 'border-blue-500 bg-blue-500/20 text-blue-300'
                : 'border-neutral-700 bg-neutral-800 text-neutral-400 hover:text-neutral-200'
            )}
          >
            <Ic size={16} />
          </button>
        )
      })}
    </div>
  )
}

// ─── Text Block Form ──────────────────────────────────────────────────────────

function TextBlockForm({
  block,
  pageId,
}: {
  block: TextBlock
  pageId: string
}) {
  const { updateBlock } = useEditorStore()
  const { register, watch } = useForm<Partial<TextBlock>>({
    defaultValues: { variant: block.variant, content: block.content, align: block.align },
  })

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  return (
    <div className="space-y-3">
      <Field label="Variant">
        <select {...register('variant')} className={selectCls}>
          {['title', 'heading', 'body', 'caption', 'quote', 'stat'].map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Content">
        <textarea
          {...register('content')}
          className={twMerge(inputCls, 'resize-y min-h-[80px]')}
          rows={4}
        />
      </Field>
      <Field label="Align">
        <select {...register('align')} className={selectCls}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>
    </div>
  )
}

// ─── Image Block Form ─────────────────────────────────────────────────────────

function ImageBlockForm({ block, pageId }: { block: ImageBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const { register, watch, setValue } = useForm<Partial<ImageBlock>>({
    defaultValues: { src: block.src, alt: block.alt, caption: block.caption, lightbox: block.lightbox },
  })
  const fileRef = useRef<HTMLInputElement>(null)
  const [uploading, setUploading] = useState(false)

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  const handleUpload = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const { createBrowserSupabase } = await import('@/lib/supabase')
      const supabase = createBrowserSupabase()
      const bookId = useEditorStore.getState().book?.id
      if (!bookId) throw new Error('No book')

      const ext = file.name.split('.').pop() ?? 'png'
      const path = `books/${bookId}/uploads/${crypto.randomUUID()}.${ext}`

      const { error } = await supabase.storage
        .from('folio-assets')
        .upload(path, file, { contentType: file.type, upsert: false })

      if (error) throw error

      const { data: { publicUrl } } = supabase.storage
        .from('folio-assets')
        .getPublicUrl(path)

      setValue('src', publicUrl, { shouldDirty: true })
      updateBlock(pageId, block.id, { src: publicUrl } as Partial<Block>)
    } catch (err) {
      console.error('Image upload failed:', err)
    } finally {
      setUploading(false)
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [pageId, block.id, setValue, updateBlock])

  return (
    <div className="space-y-3">
      <Field label="Image">
        <div className="space-y-2">
          <input {...register('src')} className={inputCls} placeholder="https://…" />
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleUpload}
          />
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="w-full py-1.5 rounded border border-dashed border-neutral-600 text-xs text-neutral-400 hover:text-neutral-200 hover:border-neutral-400 transition-colors disabled:opacity-50"
          >
            {uploading ? 'Uploading…' : '↑ Upload image file'}
          </button>
        </div>
      </Field>
      <Field label="Alt text">
        <input {...register('alt')} className={inputCls} placeholder="Describe the image" />
      </Field>
      <Field label="Caption">
        <input {...register('caption')} className={inputCls} placeholder="Optional caption" />
      </Field>
      <Field label="Lightbox">
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('lightbox')} className="accent-blue-500" />
          <span className="text-sm text-neutral-300">Enable lightbox</span>
        </label>
      </Field>
    </div>
  )
}

// ─── Video Block Form ─────────────────────────────────────────────────────────

function VideoBlockForm({ block, pageId }: { block: VideoBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const { register, watch } = useForm<Partial<VideoBlock>>({
    defaultValues: { src: block.src, poster: block.poster },
  })

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  return (
    <div className="space-y-3">
      <Field label="Video URL">
        <input {...register('src')} className={inputCls} placeholder="https://…" />
      </Field>
      <Field label="Poster URL">
        <input {...register('poster')} className={inputCls} placeholder="https://…" />
      </Field>
    </div>
  )
}

// ─── Audio Block Form ─────────────────────────────────────────────────────────

function AudioBlockForm({ block, pageId }: { block: AudioBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const { register, watch } = useForm<Partial<AudioBlock>>({
    defaultValues: { src: block.src, title: block.title },
  })

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  return (
    <div className="space-y-3">
      <Field label="Audio URL">
        <input {...register('src')} className={inputCls} placeholder="https://…" />
      </Field>
      <Field label="Title">
        <input {...register('title')} className={inputCls} placeholder="Audio title" />
      </Field>
    </div>
  )
}

// ─── Button Block Form ────────────────────────────────────────────────────────

function ButtonBlockForm({ block, pageId }: { block: ButtonBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const { register, watch } = useForm<Partial<ButtonBlock>>({
    defaultValues: { label: block.label, href: block.href, variant: block.variant },
  })

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  return (
    <div className="space-y-3">
      <Field label="Label">
        <input {...register('label')} className={inputCls} placeholder="Button text" />
      </Field>
      <Field label="URL">
        <input {...register('href')} className={inputCls} placeholder="https://…" />
      </Field>
      <Field label="Variant">
        <select {...register('variant')} className={selectCls}>
          <option value="primary">Primary</option>
          <option value="secondary">Secondary</option>
          <option value="ghost">Ghost</option>
        </select>
      </Field>
    </div>
  )
}

// ─── Embed Block Form ─────────────────────────────────────────────────────────

function EmbedBlockForm({ block, pageId }: { block: EmbedBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const { register, watch } = useForm<Partial<EmbedBlock>>({
    defaultValues: { html: block.html, height: block.height },
  })

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  return (
    <div className="space-y-3">
      <Field label="HTML">
        <textarea
          {...register('html')}
          className={twMerge(inputCls, 'resize-y min-h-[100px] font-mono text-xs')}
          rows={5}
          placeholder="<iframe …>"
        />
      </Field>
      <Field label="Height (px)">
        <input
          type="number"
          {...register('height', { valueAsNumber: true })}
          className={inputCls}
          placeholder="300"
        />
      </Field>
    </div>
  )
}

// ─── Data Block Form (living editions) ────────────────────────────────────────

function DataBlockForm({ block, pageId }: { block: DataBlock; pageId: string }) {
  const { updateBlock } = useEditorStore()
  const { register, watch, getValues } = useForm<Partial<DataBlock>>({
    defaultValues: {
      label: block.label,
      source: block.source,
      path: block.path,
      prefix: block.prefix ?? '',
      suffix: block.suffix ?? '',
      fallback: block.fallback ?? '',
      align: block.align ?? 'left',
    },
  })

  const [test, setTest] = useState<{ state: 'idle' | 'loading' | 'ok' | 'err'; value?: string; msg?: string }>({
    state: 'idle',
  })

  async function runTest() {
    const { source, path, prefix, suffix } = getValues()
    if (!source || !path) {
      setTest({ state: 'err', msg: 'Add a source and a path first.' })
      return
    }
    setTest({ state: 'loading' })
    try {
      const res = await fetch(source, { cache: 'no-store' })
      if (!res.ok) throw new Error(String(res.status))
      const json = await res.json()
      const v = path
        .split('.')
        .reduce<unknown>((acc, k) => (acc && typeof acc === 'object' ? (acc as Record<string, unknown>)[k] : undefined), json)
      if (v == null) setTest({ state: 'err', msg: `Path "${path}" not found in the source.` })
      else setTest({ state: 'ok', value: `${prefix ?? ''}${String(v)}${suffix ?? ''}` })
    } catch {
      setTest({ state: 'err', msg: 'Could not fetch or parse the source.' })
    }
  }

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, block.id, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, block.id, updateBlock])

  return (
    <div className="space-y-3">
      <p className="rounded-md bg-[#0066ff]/10 px-2.5 py-2 text-[11px] leading-4 text-[#9dc0ff]">
        Binds to a JSON source and updates after publish. Change the source data
        and every live edition reflects it — no re-export.
      </p>
      <Field label="Label">
        <input {...register('label')} className={inputCls} placeholder="e.g. Live price" />
      </Field>
      <Field label="Data source (URL or path)">
        <input {...register('source')} className={inputCls} placeholder="/demo-live.json or https://…" />
      </Field>
      <Field label="JSON path">
        <input {...register('path')} className={inputCls} placeholder="e.g. product.price" />
      </Field>
      <div className="grid grid-cols-2 gap-2">
        <Field label="Prefix">
          <input {...register('prefix')} className={inputCls} placeholder="$" />
        </Field>
        <Field label="Suffix">
          <input {...register('suffix')} className={inputCls} placeholder=" / mo" />
        </Field>
      </div>
      <Field label="Fallback (if unavailable)">
        <input {...register('fallback')} className={inputCls} placeholder="—" />
      </Field>
      <Field label="Align">
        <select {...register('align')} className={selectCls}>
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </select>
      </Field>

      <div className="space-y-2 border-t border-neutral-800 pt-3">
        <button
          type="button"
          onClick={runTest}
          disabled={test.state === 'loading'}
          className="flex w-full items-center justify-center gap-2 rounded-md bg-neutral-800 px-3 py-2 text-xs font-semibold text-neutral-200 transition-colors hover:bg-neutral-700 disabled:opacity-50"
        >
          <Lucide.RefreshCw size={13} className={test.state === 'loading' ? 'animate-spin' : ''} />
          {test.state === 'loading' ? 'Fetching…' : 'Test data source'}
        </button>
        {test.state === 'ok' && (
          <div className="flex items-center gap-2 rounded-md border border-green-500/30 bg-green-500/10 px-2.5 py-2 text-xs text-green-300">
            <Lucide.Check size={13} />
            Resolved to <span className="font-semibold text-green-200">{test.value}</span>
          </div>
        )}
        {test.state === 'err' && (
          <div className="flex items-center gap-2 rounded-md border border-red-500/30 bg-red-500/10 px-2.5 py-2 text-xs text-red-300">
            <Lucide.AlertCircle size={13} />
            {test.msg}
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Block Settings Form ──────────────────────────────────────────────────────

function BlockSettingsForm({ block, pageId }: { block: Block; pageId: string }) {
  const { removeBlock } = useEditorStore()

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
          {block.type} block
        </span>
        <button
          onClick={() => removeBlock(pageId, block.id)}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Delete
        </button>
      </div>

      {block.type === 'text' && <TextBlockForm block={block} pageId={pageId} />}
      {block.type === 'image' && <ImageBlockForm block={block} pageId={pageId} />}
      {block.type === 'video' && <VideoBlockForm block={block} pageId={pageId} />}
      {block.type === 'audio' && <AudioBlockForm block={block} pageId={pageId} />}
      {block.type === 'button' && <ButtonBlockForm block={block} pageId={pageId} />}
      {block.type === 'divider' && (
        <p className="text-xs text-neutral-500">No settings for divider block.</p>
      )}
      {block.type === 'embed' && <EmbedBlockForm block={block} pageId={pageId} />}
      {block.type === 'data' && <DataBlockForm block={block} pageId={pageId} />}
    </div>
  )
}

// ─── Page Settings Form ───────────────────────────────────────────────────────

function PageSettingsForm({ page }: { page: Page }) {
  const { updatePage } = useEditorStore()
  const { register, watch } = useForm<{
    bgColor: string
    layout: Page['layout']
    type: Page['type']
  }>({
    defaultValues: {
      bgColor: page.background?.color ?? '',
      layout: page.layout,
      type: page.type,
    },
  })

  useEffect(() => {
    const sub = watch((values) => {
      updatePage(page.id, {
        layout: values.layout as Page['layout'],
        type: values.type as Page['type'],
        background: {
          ...page.background,
          color: values.bgColor || undefined,
        },
      })
    })
    return () => sub.unsubscribe()
  }, [watch, page.id, page.background, updatePage])

  return (
    <div className="space-y-4">
      <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block">
        Page Settings
      </span>

      <Field label="Background Color">
        <div className="flex items-center gap-2">
          <input type="color" {...register('bgColor')} className="w-8 h-8 rounded cursor-pointer bg-transparent border-0" />
          <input {...register('bgColor')} className={twMerge(inputCls, 'flex-1')} placeholder="#ffffff" />
        </div>
      </Field>

      <Field label="Layout">
        <select {...register('layout')} className={selectCls}>
          <option value="hero">Hero</option>
          <option value="split">Split</option>
          <option value="text">Text</option>
          <option value="blank">Blank</option>
        </select>
      </Field>

      <Field label="Type">
        <select {...register('type')} className={selectCls}>
          <option value="cover">Cover</option>
          <option value="content">Content</option>
          <option value="back">Back</option>
        </select>
      </Field>
    </div>
  )
}

// ─── Hotspot Settings Form ────────────────────────────────────────────────────

function HotspotSettingsForm({
  hotspot,
  pageId,
}: {
  hotspot: Hotspot
  pageId: string
}) {
  const { updateHotspot, removeHotspot } = useEditorStore()
  const { register, watch, setValue } = useForm<{
    label: string
    icon: string
    modalTitle: string
    modalBody: string
    action: Hotspot['action']
    linkUrl: string
    stripeUrl: string
    price: string
    ctaLabel: string
  }>({
    defaultValues: {
      label: hotspot.label,
      icon: hotspot.icon,
      modalTitle: hotspot.modal.title,
      modalBody: hotspot.modal.body,
      action: hotspot.action || 'modal',
      linkUrl: hotspot.linkUrl || '',
      stripeUrl: hotspot.stripeUrl || '',
      price: hotspot.price || '',
      ctaLabel: hotspot.ctaLabel || '',
    },
  })

  useEffect(() => {
    const sub = watch((values) => {
      updateHotspot(pageId, hotspot.id, {
        label: values.label ?? hotspot.label,
        icon: values.icon ?? hotspot.icon,
        action: values.action,
        linkUrl: values.linkUrl,
        stripeUrl: values.stripeUrl,
        price: values.price || undefined,
        ctaLabel: values.ctaLabel || undefined,
        modal: {
          ...hotspot.modal,
          title: values.modalTitle ?? hotspot.modal.title,
          body: values.modalBody ?? hotspot.modal.body,
        },
      })
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, hotspot.id, updateHotspot]) // eslint-disable-line react-hooks/exhaustive-deps

  const action = watch('action')

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider">
          Hotspot
        </span>
        <button
          onClick={() => removeHotspot(pageId, hotspot.id)}
          className="text-xs text-red-400 hover:text-red-300 transition-colors"
        >
          Delete
        </button>
      </div>

      <Field label="Position (read-only)">
        <div className="flex gap-2">
          <div className={twMerge(inputCls, 'flex-1 text-neutral-500 cursor-default')}>
            X: {hotspot.x.toFixed(1)}%
          </div>
          <div className={twMerge(inputCls, 'flex-1 text-neutral-500 cursor-default')}>
            Y: {hotspot.y.toFixed(1)}%
          </div>
        </div>
      </Field>

      <Field label="Label">
        <input {...register('label')} className={inputCls} placeholder="Hotspot label" />
      </Field>

      <Field label="Icon">
        <IconPicker value={watch('icon')} onChange={(name) => setValue('icon', name, { shouldDirty: true })} />
      </Field>

      <Field label="Action">
        <select {...register('action')} className={selectCls}>
          <option value="modal">Show Modal</option>
          <option value="link">External Link</option>
          <option value="checkout">Stripe Checkout</option>
        </select>
      </Field>

      {action === 'link' && (
        <Field label="Link URL">
          <input {...register('linkUrl')} className={inputCls} placeholder="https://..." />
        </Field>
      )}

      {action === 'checkout' && (
        <>
          <Field label="Stripe Payment Link URL">
            <input {...register('stripeUrl')} className={inputCls} placeholder="https://buy.stripe.com/..." />
          </Field>
          <div className="grid grid-cols-2 gap-2">
            <Field label="Price">
              <input {...register('price')} className={inputCls} placeholder="$48" />
            </Field>
            <Field label="Button label">
              <input {...register('ctaLabel')} className={inputCls} placeholder="Add to cart" />
            </Field>
          </div>
        </>
      )}

      <Field label="Modal Title">
        <input {...register('modalTitle')} className={inputCls} placeholder="Modal heading" />
      </Field>

      <Field label="Modal Body (Markdown)">
        <textarea
          {...register('modalBody')}
          className={twMerge(inputCls, 'resize-y min-h-[80px]')}
          rows={4}
          placeholder="Markdown content…"
        />
      </Field>
    </div>
  )
}

// ─── Book Settings Form ───────────────────────────────────────────────────────

function BookSettingsForm({ book }: { book: any }) {
  const { updateSettings, updatePage, setBook } = useEditorStore()
  const { register, watch } = useForm({
    defaultValues: {
      password: book.settings?.password ?? '',
      burn_after_reading: book.settings?.burn_after_reading ?? false,
      unlisted: book.settings?.unlisted ?? false,
      whitelabel: book.settings?.whitelabel ?? false,
      gatingEnabled: book.settings?.gating?.enabled ?? false,
      gatingPage: book.settings?.gating?.page_number ?? 3,
      gatingTitle: book.settings?.gating?.title ?? 'Unlock the full version',
      gatingDescription: book.settings?.gating?.description ?? 'Enter your email to continue reading.',
      headingFont: book.theme?.headingFont ?? '',
      bodyFont: book.theme?.bodyFont ?? '',
      themePreset: book.theme?.preset ?? 'ivory',
    },
  })

  useEffect(() => {
    const sub = watch((values) => {
      // Update book settings
      updateSettings({
        password: values.password || undefined,
        burn_after_reading: values.burn_after_reading,
        unlisted: values.unlisted,
        whitelabel: values.whitelabel,
        gating: {
          enabled: values.gatingEnabled ?? false,
          page_number: values.gatingPage ?? 3,
          type: 'email',
          title: values.gatingTitle ?? 'Unlock the full version',
          description: values.gatingDescription ?? 'Enter your email to continue reading.',
        },
      })
      
      // Update book theme globally via a direct store set if needed, or we can just patch it here
      const state = useEditorStore.getState()
      if (state.book) {
        state.setBook({
          ...state.book,
          theme: {
            ...state.book.theme,
            preset: values.themePreset as any,
            headingFont: values.headingFont || undefined,
            bodyFont: values.bodyFont || undefined,
          }
        })
      }
    })
    return () => sub.unsubscribe()
  }, [watch, updateSettings])

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block">
          Theme & Typography
        </span>
        <Field label="Theme Preset">
          <select {...register('themePreset')} className={selectCls}>
            <option value="ivory">Ivory (Light)</option>
            <option value="slate">Slate (Dark)</option>
            <option value="cream">Cream (Warm)</option>
            <option value="carbon">Carbon (Black)</option>
            <option value="sage">Sage (Green)</option>
          </select>
        </Field>
        <Field label="Heading Font">
          <input {...register('headingFont')} className={inputCls} placeholder="e.g. Inter, serif" />
        </Field>
        <Field label="Body Font">
          <input {...register('bodyFont')} className={inputCls} placeholder="e.g. Roboto, sans-serif" />
        </Field>
      </div>

      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block">
          Access Control
        </span>

        <Field label="Password Protection">
          <input
            {...register('password')}
            className={inputCls}
            placeholder="Optional password"
            type="password"
          />
        </Field>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('burn_after_reading')} className="accent-blue-500" />
          <span className="text-sm text-neutral-300">Burn after reading (View once)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('unlisted')} className="accent-blue-500" />
          <span className="text-sm text-neutral-300">Unlisted (Hide from search)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('whitelabel')} className="accent-blue-500" />
          <span className="text-sm text-neutral-300">Remove "Made with Riffle" branding</span>
        </label>
      </div>

      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block">
          Lead Magnet Gating
        </span>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('gatingEnabled')} className="accent-blue-500" />
          <span className="text-sm text-neutral-300">Enable Email Gating</span>
        </label>

        {watch('gatingEnabled') && (
          <div className="space-y-3 pl-4 border-l border-neutral-800">
            <Field label="Gate at Page">
              <input
                type="number"
                {...register('gatingPage', { valueAsNumber: true })}
                className={inputCls}
              />
            </Field>
            <Field label="Modal Title">
              <input {...register('gatingTitle')} className={inputCls} />
            </Field>
            <Field label="Description">
              <textarea {...register('gatingDescription')} className={twMerge(inputCls, 'resize-none')} rows={2} />
            </Field>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Settings Panel ───────────────────────────────────────────────────────────

export function SettingsPanel() {
  const { book, currentPageIndex, selectedBlockId, selectedHotspotId } = useEditorStore()
  const [tab, setTab] = useState<'selection' | 'book'>('selection')

  // Auto-switch to selection tab when something is selected
  useEffect(() => {
    if (selectedBlockId || selectedHotspotId) {
      setTab('selection')
    }
  }, [selectedBlockId, selectedHotspotId])

  const currentPage = book?.pages?.[currentPageIndex]

  if (!book || !currentPage) {
    return (
      <div className="flex-1 flex items-center justify-center text-neutral-600 text-sm p-4">
        No page loaded
      </div>
    )
  }

  const selectedBlock = selectedBlockId
    ? currentPage.blocks.find((b) => b.id === selectedBlockId)
    : null

  const selectedHotspot = selectedHotspotId
    ? currentPage.hotspots.find((h) => h.id === selectedHotspotId)
    : null

  return (
    <div className="flex flex-col h-full overflow-hidden">
      <div className="flex items-center border-b border-neutral-800 shrink-0">
        <button
          onClick={() => setTab('selection')}
          className={twMerge(
            'flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors',
            tab === 'selection' ? 'text-white border-b-2 border-primary bg-neutral-800/50' : 'text-neutral-500 hover:text-neutral-300'
          )}
        >
          Selection
        </button>
        <button
          onClick={() => setTab('book')}
          className={twMerge(
            'flex-1 py-3 text-[10px] font-bold uppercase tracking-widest transition-colors',
            tab === 'book' ? 'text-white border-b-2 border-primary bg-neutral-800/50' : 'text-neutral-500 hover:text-neutral-300'
          )}
        >
          Book Settings
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3">
        {tab === 'book' ? (
          <BookSettingsForm book={book} />
        ) : selectedBlock ? (
          <BlockSettingsForm block={selectedBlock} pageId={currentPage.id} />
        ) : selectedHotspot ? (
          <HotspotSettingsForm hotspot={selectedHotspot} pageId={currentPage.id} />
        ) : (
          <PageSettingsForm page={currentPage} />
        )}
      </div>
    </div>
  )
}
