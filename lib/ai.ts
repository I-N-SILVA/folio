import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Hotspot } from './book-schema'
import { v4 as uuidv4 } from 'uuid'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

/**
 * Whether an AI key is configured at all.
 *
 * The client above is constructed with `|| ''`, so without a key every call
 * still made a real request that failed auth. A 50-page import runs hotspot
 * detection per page, so an install that left this blank — .env.example marks
 * it optional and ships it empty — spent 50 round-trips and 50 error lines
 * discovering the same thing each time. Callers should check first.
 */
export function isAiEnabled(): boolean {
  return Boolean(process.env.GOOGLE_GENERATIVE_AI_API_KEY)
}

/**
 * The image type, read from the file's first bytes.
 *
 * Every image used to be sent to Gemini labelled `image/png`. Imported pages
 * are WebP now, and an author's uploaded JPEG never was PNG; the label is what
 * the model decodes by, so it has to be the truth.
 */
export function imageMimeType(buf: Buffer): string {
  if (buf.length >= 12 && buf.toString('ascii', 0, 4) === 'RIFF' && buf.toString('ascii', 8, 12) === 'WEBP') {
    return 'image/webp'
  }
  if (buf.length >= 3 && buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return 'image/jpeg'
  if (buf.length >= 6 && buf.toString('ascii', 0, 3) === 'GIF') return 'image/gif'
  return 'image/png'
}

export async function detectHotspots(imageBuffer: Buffer, pageNumber: number): Promise<Hotspot[]> {
  if (!isAiEnabled()) return []
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `
      Analyze this page from a brochure/catalog. 
      Identify all products, links, or sections that should be interactive.
      For each item, provide:
      1. A short label
      2. Coordinates (x, y) from 0 to 100 representing the center of the item.
      3. A title and a brief description for a modal.
      
      Return ONLY a valid JSON array of objects with this structure:
      [{ "label": "Product Name", "x": 45.2, "y": 60.1, "modal": { "title": "Product", "body": "Details..." } }]
    `

    const result = await model.generateContent([
      prompt,
      {
        inlineData: {
          data: imageBuffer.toString('base64'),
          mimeType: imageMimeType(imageBuffer),
        },
      },
    ])

    const text = result.response.text()
    const jsonStr = text.match(/\[[\s\S]*\]/)?.[0] || '[]'
    const detected = JSON.parse(jsonStr)

    return detected.map((item: any) => ({
      id: uuidv4(),
      label: item.label || 'Info',
      x: item.x,
      y: item.y,
      icon: 'Info',
      modal: {
        title: item.modal?.title || item.label,
        body: item.modal?.body || '',
      },
      action: 'modal',
    }))
  } catch (error) {
    console.error(`[AI] Hotspot detection failed for page ${pageNumber}:`, error)
    return []
  }
}

export async function analyzeBookSEO(imageBuffers: Buffer[], title: string): Promise<{ description: string; keywords: string }> {
  if (!isAiEnabled()) return { description: '', keywords: '' }
  try {
    const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' })

    const prompt = `
      Analyze these pages from a digital book titled "${title}".
      Generate highly optimized SEO metadata for this book to help it rank on search engines.
      
      Return ONLY a valid JSON object with this structure:
      {
        "description": "A compelling, 150-character meta description...",
        "keywords": "comma, separated, list, of, keywords"
      }
    `

    const imageParts = imageBuffers.map(buf => ({
      inlineData: {
        data: buf.toString('base64'),
        mimeType: imageMimeType(buf),
      },
    }))

    const result = await model.generateContent([prompt, ...imageParts])

    const text = result.response.text()
    const jsonStr = text.match(/\{[\s\S]*\}/)?.[0] || '{"description": "", "keywords": ""}'
    return JSON.parse(jsonStr)
  } catch (error) {
    console.error(`[AI] SEO analysis failed:`, error)
    return { description: '', keywords: '' }
  }
}
