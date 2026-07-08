'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { useEditorStore } from '@/lib/editor-store'
import type { Hotspot } from '@/lib/book-schema'
import { Field, IconPicker, inputCls, selectCls } from './shared'

export function HotspotSettingsForm({
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
