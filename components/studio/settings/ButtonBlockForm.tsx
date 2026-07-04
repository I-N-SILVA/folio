'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { useEditorStore } from '@/lib/editor-store'
import type { Block, ButtonBlock } from '@/lib/book-schema'
import { Field, inputCls, selectCls } from './shared'

export function ButtonBlockForm({ block, pageId }: { block: ButtonBlock; pageId: string }) {
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
