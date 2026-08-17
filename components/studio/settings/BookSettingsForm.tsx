'use client'

import { useEffect } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import Link from 'next/link'
import { Lock } from 'lucide-react'
import { useEditorStore } from '@/lib/editor-store'
import { useEntitlements } from '@/components/studio/EntitlementsContext'
import { Field, FieldGroup, Toggle, inputCls, selectCls } from './shared'

/** A control the current plan doesn't include — shown, disabled, with the way out. */
function LockedFeature({
  label,
  hint,
  planName,
}: {
  label: string
  hint?: string
  planName: string
}) {
  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950/40 p-3">
      <div className="flex items-start gap-2">
        <Lock size={13} className="mt-0.5 shrink-0 text-neutral-500" />
        <div className="min-w-0">
          <p className="text-sm text-neutral-400">{label}</p>
          {hint && <p className="mt-1 text-[11px] leading-4 text-neutral-500">{hint}</p>}
          <p className="mt-2 text-[11px] leading-4 text-neutral-500">
            Not included in {planName}.{' '}
            <Link
              href="/account"
              target="_blank"
              className="font-semibold text-[var(--accent-vivid)] hover:underline"
            >
              See plans
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}

/** Faces the reader is guaranteed to get: the theme default, or a web-safe stack. */
const FONT_CHOICES = [
  { value: '', label: 'Theme default' },
  { value: 'Georgia, serif', label: 'Serif — Georgia' },
  { value: 'Palatino, "Palatino Linotype", serif', label: 'Serif — Palatino' },
  { value: '"Helvetica Neue", Helvetica, Arial, sans-serif', label: 'Sans — Helvetica' },
  { value: 'system-ui, sans-serif', label: 'Sans — System' },
  { value: '"Courier New", monospace', label: 'Mono — Courier' },
]

export function BookSettingsForm({ book }: { book: any }) {
  const { updateSettings, updateTheme } = useEditorStore()
  const entitlements = useEntitlements()
  const { register, watch, setValue } = useForm({
    defaultValues: {
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
        {/* These were free-text family names. Typing one you have installed
            locally produced an edition that looked right to you and fell back to
            something else for every reader — a difference the author had no way
            to see. */}
        <Field label="Heading font">
          <select {...register('headingFont')} className={selectCls}>
            {FONT_CHOICES.map((f) => (
              <option key={f.value || 'theme'} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Body font">
          <select {...register('bodyFont')} className={selectCls}>
            {FONT_CHOICES.map((f) => (
              <option key={f.value || 'theme'} value={f.value}>
                {f.label}
              </option>
            ))}
          </select>
        </Field>
      </FieldGroup>

      {/* "Password Protection" and "Burn after reading (View once)" used to sit
          here. Nothing in the app read either value: a password-protected
          edition served in full to anyone with the link, and a view-once
          edition could be reopened forever. Offering them was worse than
          omitting them — someone could ship a confidential document believing
          it was protected. The schema fields are now gone too, so there is
          nothing left to accidentally wire a control back onto. */}
      <FieldGroup title="Access">
        <Toggle
          label="Unlisted — ask search engines not to index"
          checked={watch('unlisted')}
          onChange={(next) => setValue('unlisted', next, { shouldDirty: true })}
        />
        {/* Both of the controls below are plan features, and the reader resolves
            them from the plan rather than from what gets written here. Locking
            them in the UI is so the author finds out now instead of wondering
            why a switched-on gate never appears. */}
        {entitlements.whiteLabel ? (
          <Toggle
            label="Remove the “Powered by QLICO” badge"
            checked={watch('whitelabel')}
            onChange={(next) => setValue('whitelabel', next, { shouldDirty: true })}
          />
        ) : (
          <LockedFeature
            label="Remove the “Powered by QLICO” badge"
            planName={entitlements.planName}
          />
        )}
      </FieldGroup>

      <FieldGroup title="Email capture">
        {entitlements.leadGating ? (
          <Toggle
            label="Ask for an email to keep reading"
            checked={watch('gatingEnabled')}
            onChange={(next) => setValue('gatingEnabled', next, { shouldDirty: true })}
          />
        ) : (
          <LockedFeature
            label="Ask for an email to keep reading"
            hint="Readers give you their address to unlock the rest of the edition. Captured addresses land in Insights."
            planName={entitlements.planName}
          />
        )}

        {entitlements.leadGating && watch('gatingEnabled') && (
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
