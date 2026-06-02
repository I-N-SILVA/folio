/**
 * Client-side PDF → PNG renderer using pdf.js
 *
 * Renders each page of a PDF to a canvas, then converts to Blob.
 * Designed for use in the browser only (requires OffscreenCanvas / HTMLCanvasElement).
 */

import * as pdfjsLib from 'pdfjs-dist'

// Serve the bundled pdf.js worker from /public to avoid webpack ESM worker quirks.
pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

export interface RenderedPage {
  pageNumber: number
  blob: Blob
  width: number
  height: number
}

export interface RenderProgress {
  current: number
  total: number
  phase: 'loading' | 'rendering'
}

/**
 * Render all pages of a PDF file to PNG blobs.
 *
 * @param file        The PDF File object
 * @param maxPages    Maximum number of pages to render (default: 50)
 * @param scale       Render scale — 2 gives good quality at ~1200px wide for A4
 * @param onProgress  Callback for progress updates
 * @returns           Array of rendered page blobs
 */
export async function renderPdfPages(
  file: File,
  {
    maxPages = 50,
    scale = 2,
    onProgress,
  }: {
    maxPages?: number
    scale?: number
    onProgress?: (progress: RenderProgress) => void
  } = {}
): Promise<RenderedPage[]> {
  onProgress?.({ current: 0, total: 0, phase: 'loading' })

  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise

  const totalPages = Math.min(pdf.numPages, maxPages)
  const results: RenderedPage[] = []

  for (let i = 1; i <= totalPages; i++) {
    onProgress?.({ current: i, total: totalPages, phase: 'rendering' })

    const page = await pdf.getPage(i)
    const viewport = page.getViewport({ scale })

    // Create a canvas for this page
    const canvas = document.createElement('canvas')
    canvas.width = viewport.width
    canvas.height = viewport.height
    const ctx = canvas.getContext('2d')!

    await page.render({ canvas, canvasContext: ctx, viewport }).promise

    // Convert to blob
    const blob = await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob(
        (b) => (b ? resolve(b) : reject(new Error(`Failed to render page ${i}`))),
        'image/png',
        0.92
      )
    })

    results.push({
      pageNumber: i,
      blob,
      width: viewport.width,
      height: viewport.height,
    })

    // Clean up
    page.cleanup()
  }

  pdf.destroy()
  return results
}
