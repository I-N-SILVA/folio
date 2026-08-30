'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import { twMerge } from 'tailwind-merge'
import Link from 'next/link'
import { Lock, Globe, Send, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react'
import { useEditorStore } from '@/lib/editor-store'
import { useEntitlements } from '@/components/studio/EntitlementsContext'
import { Field, FieldGroup, Toggle, inputCls, selectCls } from './shared'
import { SlugField } from './SlugField'

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
  const [testingWebhook, setTestingWebhook] = useState(false)
  const [webhookResult, setWebhookResult] = useState<{ ok?: boolean; message?: string } | null>(null)

  const { register, watch, setValue } = useForm({
    defaultValues: {
      unlisted: book.settings?.unlisted ?? false,
      whitelabel: book.settings?.whitelabel ?? false,
      webhookUrl: book.settings?.webhookUrl ?? book.settings?.gating?.webhookUrl ?? '',
      customDomain: book.settings?.customDomain ?? '',
      gatingEnabled: book.settings?.gating?.enabled ?? false,
      gatingPage: book.settings?.gating?.page_number ?? 3,
      gatingType: book.settings?.gating?.type ?? 'email',
      gatingTitle: book.settings?.gating?.title ?? 'Unlock the full version',
      gatingDescription: book.settings?.gating?.description ?? 'Enter your credentials to continue reading.',
      gatingPasscode: book.settings?.gating?.passcode ?? '',
      gatingAllowedDomains: (book.settings?.gating?.allowedDomains ?? []).join(', '),
      headingFont: book.theme?.headingFont ?? '',
      bodyFont: book.theme?.bodyFont ?? '',
      themePreset: book.theme?.preset ?? 'ivory',
    },
  })

  const currentWebhookUrl = watch('webhookUrl')

  async function handleTestWebhook() {
    if (!currentWebhookUrl) return
    setTestingWebhook(true)
    setWebhookResult(null)
    try {
      const res = await fetch('/api/webhooks/test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: currentWebhookUrl,
          title: book.title,
          slug: book.slug,
        }),
      })
      const data = await res.json()
      if (res.ok && data.success) {
        setWebhookResult({ ok: true, message: `Delivered (HTTP ${data.status})` })
      } else {
        setWebhookResult({ ok: false, message: data.error || 'Failed to deliver payload' })
      }
    } catch (err: any) {
      setWebhookResult({ ok: false, message: err?.message || 'Network error' })
    } finally {
      setTestingWebhook(false)
    }
  }

  useEffect(() => {
    const sub = watch((values) => {
      const domains = typeof values.gatingAllowedDomains === 'string'
        ? values.gatingAllowedDomains.split(',').map((d: string) => d.trim()).filter(Boolean)
        : undefined

      // Update book settings
      updateSettings({
        unlisted: values.unlisted,
        whitelabel: values.whitelabel,
        webhookUrl: values.webhookUrl || undefined,
        customDomain: values.customDomain || undefined,
        gating: {
          enabled: values.gatingEnabled ?? false,
          page_number: values.gatingPage ?? 3,
          type: (values.gatingType as any) || 'email',
          title: values.gatingTitle ?? 'Unlock the full version',
          description: values.gatingDescription ?? 'Enter your credentials to continue reading.',
          passcode: values.gatingPasscode || undefined,
          allowedDomains: domains,
          webhookUrl: values.webhookUrl || undefined,
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
      {/* The public address used to be permanent, because nothing could forward
          the old one — so a typo in the link that went out in an email was
          forever. It can be changed now, and the old address redirects. */}
      <FieldGroup title="Link">
        <SlugField bookId={book.id} slug={book.slug} />
      </FieldGroup>

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

      <FieldGroup title="Access Control & Gating">
        {entitlements.leadGating ? (
          <Toggle
            label="Gate access to the edition"
            checked={watch('gatingEnabled')}
            onChange={(next) => setValue('gatingEnabled', next, { shouldDirty: true })}
          />
        ) : (
          <LockedFeature
            label="Gate access to the edition"
            hint="Require an email, passcode, or corporate domain to unlock the full publication."
            planName={entitlements.planName}
          />
        )}

        {entitlements.leadGating && watch('gatingEnabled') && (
          <div className="space-y-3 border-l border-neutral-800 pl-4">
            <Field label="Security & Gating Mode">
              <select {...register('gatingType')} className={selectCls}>
                <option value="email">Email Lead Capture (Public)</option>
                <option value="passcode">Secret Passcode (Confidential / NDA)</option>
                <option value="domain">Corporate Domain Whitelist (Enterprise)</option>
              </select>
            </Field>

            {watch('gatingType') === 'passcode' && (
              <Field
                label="Secret Passcode"
                hint="Readers must enter this exact code to view locked pages."
              >
                <input
                  type="text"
                  placeholder="e.g. VIP2026 or CONFIDENTIAL"
                  {...register('gatingPasscode')}
                  className={twMerge(inputCls, 'font-mono')}
                />
              </Field>
            )}

            {watch('gatingType') === 'domain' && (
              <Field
                label="Allowed Corporate Domains"
                hint="Comma-separated domains (e.g. apple.com, lvmh.com, vogue.com)"
              >
                <input
                  type="text"
                  placeholder="e.g. acme.com, agency.io"
                  {...register('gatingAllowedDomains')}
                  className={inputCls}
                />
              </Field>
            )}

            <Field
              label="Gate at page"
              hint={`Pages 1–${Math.max(0, (watch('gatingPage') || 3) - 1)} stay readable; the rest are withheld until verified.`}
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

            <Field
              label="Live Lead Webhook (Zapier, Make, HubSpot)"
              hint="Forward every captured email to your CRM or automation pipeline instantly."
            >
              <div className="flex gap-2">
                <input
                  type="url"
                  placeholder="https://hooks.zapier.com/hooks/catch/..."
                  {...register('webhookUrl')}
                  className={twMerge(inputCls, 'text-xs')}
                />
                <button
                  type="button"
                  onClick={handleTestWebhook}
                  disabled={testingWebhook || !currentWebhookUrl}
                  className="flex items-center gap-1 shrink-0 rounded-lg border border-neutral-800 bg-neutral-900 px-3 py-1.5 text-xs font-semibold text-neutral-300 transition-colors hover:bg-neutral-800 hover:text-white disabled:opacity-40"
                >
                  {testingWebhook ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} />}
                  Test
                </button>
              </div>
              {webhookResult && (
                <div
                  className={twMerge(
                    'mt-2 flex items-center gap-1.5 text-[11px]',
                    webhookResult.ok ? 'text-green-400' : 'text-red-400'
                  )}
                >
                  {webhookResult.ok ? <CheckCircle2 size={12} /> : <AlertCircle size={12} />}
                  {webhookResult.message}
                </div>
              )}
            </Field>
          </div>
        )}
      </FieldGroup>

      <FieldGroup title="Custom domain (White-label)">
        <Field
          label="Domain or Subdomain"
          hint="Point a CNAME record for your domain (e.g. catalog.brand.com) to cname.qlico.app"
        >
          <div className="relative">
            <Globe size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-500" />
            <input
              type="text"
              placeholder="editions.yourbrand.com"
              {...register('customDomain')}
              className={twMerge(inputCls, 'pl-8 text-xs font-mono')}
            />
          </div>
        </Field>
      </FieldGroup>
    </div>
  )
}
