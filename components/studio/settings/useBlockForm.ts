'use client'

import { useEffect } from 'react'
import {
  useForm,
  type DefaultValues,
  type FieldValues,
  type Path,
  type UseFormReturn,
} from 'react-hook-form'
import { useEditorStore } from '@/lib/editor-store'
import { normalizeLink } from '@/lib/normalize-url'
import type { Block } from '@/lib/book-schema'

/**
 * The inspector form for one block.
 *
 * Eight of these forms had the identical `useForm` + `watch` + `updateBlock`
 * effect copied into them, which is eight places to forget a dependency and
 * eight places a fix has to be applied. It also meant there was nowhere to put
 * the one thing every one of them needed — see `urlField` below.
 */
export function useBlockForm<T extends FieldValues>(
  pageId: string,
  blockId: string,
  defaultValues: DefaultValues<T>
): UseFormReturn<T> {
  const updateBlock = useEditorStore((s) => s.updateBlock)
  const form = useForm<T>({ defaultValues })
  const { watch } = form

  useEffect(() => {
    const sub = watch((values) => {
      updateBlock(pageId, blockId, values as Partial<Block>)
    })
    return () => sub.unsubscribe()
  }, [watch, pageId, blockId, updateBlock])

  return form
}

/**
 * Register a field that holds a link or a media source.
 *
 * Identical to `register(name)` except that leaving the field normalises what
 * is in it — `example.com` becomes `https://example.com`. That is not a
 * cosmetic nicety: a bare domain is rejected by `draftableHref`, and because
 * the save route validates the whole edition as one array, one of them 400'd
 * every autosave for the entire book. Normalising on blur rather than on each
 * keystroke leaves the author free to type.
 *
 * Deliberately does not touch a value that already carries a scheme, so
 * `javascript:` still reaches the schema and is still refused there.
 */
export function urlField<T extends FieldValues>(
  // Only the two methods it needs, so this works both with `useBlockForm` and
  // with the forms that still call `useForm` directly for their own state.
  form: Pick<UseFormReturn<T>, 'register' | 'setValue'>,
  name: Path<T>
) {
  const registered = form.register(name)
  return {
    ...registered,
    onBlur: (event: React.FocusEvent<HTMLInputElement>) => {
      const normalized = normalizeLink(event.target.value)
      if (normalized !== event.target.value) {
        // `shouldDirty` so the autosave sees it; `shouldValidate` is pointless
        // here because the real check is the schema on the way out.
        form.setValue(name, normalized as never, { shouldDirty: true })
      }
      return registered.onBlur(event)
    },
  }
}
