import type { Page } from './book-schema'

/**
 * Extract clean, readable plain text from a book page for narration.
 */
export function extractPageSpeechText(page?: Page | null): string {
  if (!page) return ''
  const parts: string[] = []

  for (const block of page.blocks ?? []) {
    if (block.type === 'text') {
      const cleanContent = block.content
        .replace(/#+\s*/g, '') // remove markdown headers
        .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1') // remove links
        .replace(/[*_~`]/g, '') // remove markdown formatting
        .trim()
      if (cleanContent) parts.push(cleanContent)
    } else if (block.type === 'image' && block.caption) {
      parts.push(`Image: ${block.caption}`)
    }
  }

  for (const hotspot of page.hotspots ?? []) {
    if (hotspot.label) {
      parts.push(hotspot.label)
    }
  }

  return parts.join('. ')
}

export function isSpeechSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window
}

let activeUtterance: SpeechSynthesisUtterance | null = null

export function speakPageText(
  text: string,
  options?: {
    rate?: number
    pitch?: number
    onStart?: () => void
    onEnd?: () => void
    onError?: (err: any) => void
  }
) {
  if (!isSpeechSupported()) return

  stopSpeech()

  if (!text.trim()) {
    options?.onEnd?.()
    return
  }

  const utterance = new SpeechSynthesisUtterance(text)
  utterance.rate = options?.rate ?? 1
  utterance.pitch = options?.pitch ?? 1
  utterance.lang = 'en-US'

  utterance.onstart = () => {
    options?.onStart?.()
  }

  utterance.onend = () => {
    activeUtterance = null
    options?.onEnd?.()
  }

  utterance.onerror = (e) => {
    activeUtterance = null
    options?.onError?.(e)
  }

  activeUtterance = utterance
  window.speechSynthesis.speak(utterance)
}

export function stopSpeech() {
  if (!isSpeechSupported()) return
  activeUtterance = null
  window.speechSynthesis.cancel()
}

export function pauseSpeech() {
  if (!isSpeechSupported()) return
  window.speechSynthesis.pause()
}

export function resumeSpeech() {
  if (!isSpeechSupported()) return
  window.speechSynthesis.resume()
}
