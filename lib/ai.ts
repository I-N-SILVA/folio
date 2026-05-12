import { GoogleGenerativeAI } from '@google/generative-ai'
import type { Hotspot } from './book-schema'
import { v4 as uuidv4 } from 'uuid'

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_GENERATIVE_AI_API_KEY || '')

export async function detectHotspots(imageBuffer: Buffer, pageNumber: number): Promise<Hotspot[]> {
  // ... existing code ...
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
          mimeType: 'image/png',
        },
      },
    ])

    const text = result.response.text()
    const jsonStr = text.match(/\[.*\]/s)?.[0] || '[]'
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
        mimeType: 'image/png',
      },
    }))

    const result = await model.generateContent([prompt, ...imageParts])

    const text = result.response.text()
    const jsonStr = text.match(/\{.*\}/s)?.[0] || '{"description": "", "keywords": ""}'
    return JSON.parse(jsonStr)
  } catch (error) {
    console.error(`[AI] SEO analysis failed:`, error)
    return { description: '', keywords: '' }
  }
}
