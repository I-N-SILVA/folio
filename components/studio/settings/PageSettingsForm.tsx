'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { useEditorStore } from '@/lib/editor-store'
import type { Page } from '@/lib/book-schema'
import { Field, inputCls, selectCls } from './shared'

export function PageSettingsForm({ page }: { page: Page }) {
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
