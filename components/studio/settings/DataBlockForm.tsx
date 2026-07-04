'use client'

import { useEffect, useState } from 'react'
import { useForm } from 'react-hook-form'
import * as Lucide from 'lucide-react'
import { useEditorStore } from '@/lib/editor-store'
import type { Block, DataBlock } from '@/lib/book-schema'
import { Field, inputCls, selectCls } from './shared'

export function DataBlockForm({ block, pageId }: { block: DataBlock; pageId: string }) {
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
      <p className="rounded-md bg-[var(--accent-vivid)]/10 px-2.5 py-2 text-[11px] leading-4 text-[#c7b8ff]">
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
