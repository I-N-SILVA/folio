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
    beaconStyle: Hotspot['beaconStyle']
    stepNumber: number
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
      beaconStyle: hotspot.beaconStyle || 'pulse',
      stepNumber: hotspot.stepNumber || 1,
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
        beaconStyle: values.beaconStyle,
        stepNumber: values.stepNumber ? Number(values.stepNumber) : undefined,
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
  const beaconStyle = watch('beaconStyle')

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

      <Field
        label="Position (% of page)"
        hint="Drag the pin on the page, nudge with arrow keys, or enter exact percentages."
      >
        <div className="flex gap-2 items-center">
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-500">X</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={Number(hotspot.x.toFixed(1))}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) {
                  updateHotspot(pageId, hotspot.id, { x: Math.min(100, Math.max(0, val)) })
                }
              }}
              className={twMerge(inputCls, 'pl-7 text-neutral-200')}
            />
          </div>
          <div className="relative flex-1">
            <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-xs font-semibold text-neutral-500">Y</span>
            <input
              type="number"
              min={0}
              max={100}
              step={0.5}
              value={Number(hotspot.y.toFixed(1))}
              onChange={(e) => {
                const val = parseFloat(e.target.value)
                if (!isNaN(val)) {
                  updateHotspot(pageId, hotspot.id, { y: Math.min(100, Math.max(0, val)) })
                }
              }}
              className={twMerge(inputCls, 'pl-7 text-neutral-200')}
            />
          </div>
        </div>
      </Field>

      <Field label="Beacon Visual Treatment">
        <div className="grid grid-cols-3 gap-1.5 pt-1">
          {[
            { id: 'pulse', label: 'Radar Pulse', desc: 'Glowing halo' },
            { id: 'shopping', label: 'Price Pill', desc: 'Luxury tag' },
            { id: 'audio', label: 'Soundwave', desc: 'Audio beacon' },
            { id: 'step', label: 'Numbered', desc: 'Tour step' },
            { id: 'minimal', label: 'Minimal Dot', desc: 'Clean point' },
          ].map((style) => (
            <button
              key={style.id}
              type="button"
              onClick={() => {
                setValue('beaconStyle', style.id as Hotspot['beaconStyle'], { shouldDirty: true })
                updateHotspot(pageId, hotspot.id, { beaconStyle: style.id as Hotspot['beaconStyle'] })
              }}
              className={twMerge(
                'rounded-lg border px-2 py-1.5 text-left transition text-xs',
                beaconStyle === style.id
                  ? 'border-[var(--studio-select)] bg-[var(--studio-select)]/10 text-white font-bold'
                  : 'border-neutral-800 bg-neutral-900/60 text-neutral-400 hover:border-neutral-700 hover:text-neutral-200'
              )}
            >
              <div className="font-semibold">{style.label}</div>
              <div className="text-[9px] text-neutral-500 truncate">{style.desc}</div>
            </button>
          ))}
        </div>
      </Field>

      {beaconStyle === 'step' && (
        <Field label="Step Number (1-99)">
          <input
            type="number"
            min={1}
            max={99}
            {...register('stepNumber')}
            className={inputCls}
            placeholder="1"
          />
        </Field>
      )}

      <Field label="Label">
        <input {...register('label')} className={inputCls} placeholder="Hotspot label" />
      </Field>

      {beaconStyle !== 'shopping' && beaconStyle !== 'minimal' && (
        <Field label="Icon">
          <IconPicker value={watch('icon')} onChange={(name) => setValue('icon', name, { shouldDirty: true })} />
        </Field>
      )}

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
