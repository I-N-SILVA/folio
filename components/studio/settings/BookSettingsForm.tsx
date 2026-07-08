'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { useEditorStore } from '@/lib/editor-store'
import { Field, inputCls, selectCls } from './shared'

export function BookSettingsForm({ book }: { book: any }) {
  const { updateSettings, updateTheme } = useEditorStore()
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

      // Update book theme via the dedicated action so the edit is tracked
      // as dirty/undoable instead of being silently marked "saved".
      updateTheme({
        preset: values.themePreset as any,
        headingFont: values.headingFont || undefined,
        bodyFont: values.bodyFont || undefined,
      })
    })
    return () => sub.unsubscribe()
  }, [watch, updateSettings, updateTheme])

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
          <input type="checkbox" {...register('burn_after_reading')} className="accent-[var(--accent-vivid)]" />
          <span className="text-sm text-neutral-300">Burn after reading (View once)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('unlisted')} className="accent-[var(--accent-vivid)]" />
          <span className="text-sm text-neutral-300">Unlisted (Hide from search)</span>
        </label>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('whitelabel')} className="accent-[var(--accent-vivid)]" />
          <span className="text-sm text-neutral-300">Remove "Made with QLICO" branding</span>
        </label>
      </div>

      <div className="space-y-4 pt-4 border-t border-neutral-800">
        <span className="text-xs font-semibold text-neutral-300 uppercase tracking-wider block">
          Lead Magnet Gating
        </span>

        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" {...register('gatingEnabled')} className="accent-[var(--accent-vivid)]" />
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
