'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import { useEditorStore } from '@/lib/editor-store'
import { Field, FieldGroup, Toggle, inputCls, selectCls } from './shared'

export function BookSettingsForm({ book }: { book: any }) {
  const { updateSettings, updateTheme } = useEditorStore()
  const { register, watch, setValue } = useForm({
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
      <FieldGroup title="Theme & typography">
        <Field label="Theme preset">
          <select {...register('themePreset')} className={selectCls}>
            <option value="ivory">Ivory (Light)</option>
            <option value="slate">Slate (Dark)</option>
            <option value="cream">Cream (Warm)</option>
            <option value="carbon">Carbon (Black)</option>
            <option value="sage">Sage (Green)</option>
          </select>
        </Field>
        <Field label="Heading font">
          <input {...register('headingFont')} className={inputCls} placeholder="e.g. Inter, serif" />
        </Field>
        <Field label="Body font">
          <input {...register('bodyFont')} className={inputCls} placeholder="e.g. Roboto, sans-serif" />
        </Field>
      </FieldGroup>

      {/* "Password Protection" and "Burn after reading (View once)" used to sit
          here. Nothing in the app read either value: a password-protected
          edition served in full to anyone with the link, and a view-once
          edition could be reopened forever. Offering them was worse than
          omitting them — someone could ship a confidential document believing
          it was protected. The schema fields are kept so stored values survive,
          but the controls are gone until the behaviour exists. */}
      <FieldGroup title="Access">
        <Toggle
          label="Unlisted — hide from search engines"
          checked={watch('unlisted')}
          onChange={(next) => setValue('unlisted', next, { shouldDirty: true })}
        />
        <Toggle
          label="Remove “Made with QLICO” branding"
          checked={watch('whitelabel')}
          onChange={(next) => setValue('whitelabel', next, { shouldDirty: true })}
        />
      </FieldGroup>

      <FieldGroup title="Lead gating">
        <Toggle
          label="Ask for an email to keep reading"
          checked={watch('gatingEnabled')}
          onChange={(next) => setValue('gatingEnabled', next, { shouldDirty: true })}
        />

        {watch('gatingEnabled') && (
          <div className="space-y-3 border-l border-neutral-800 pl-4">
            <Field
              label="Gate at page"
              hint={`Pages 1–${Math.max(0, (watch('gatingPage') || 3) - 1)} stay readable; the rest are withheld until an email is given.`}
            >
              <input
                type="number"
                min={1}
                {...register('gatingPage', { valueAsNumber: true })}
                className={inputCls}
              />
            </Field>
            <Field label="Heading">
              <input {...register('gatingTitle')} className={inputCls} />
            </Field>
            <Field label="Description">
              <textarea
                {...register('gatingDescription')}
                className={twMerge(inputCls, 'resize-none')}
                rows={2}
              />
            </Field>
          </div>
        )}
      </FieldGroup>
    </div>
  )
}
