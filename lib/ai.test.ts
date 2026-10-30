import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// The Gemini client is constructed at module scope, so the mock has to be in
// place before the import — hence doMock + resetModules per test rather than a
// top-level vi.mock and a single import.
const getGenerativeModel = vi.fn()

async function loadAi(key: string | undefined) {
  vi.resetModules()
  if (key === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
  else process.env.GOOGLE_GENERATIVE_AI_API_KEY = key

  vi.doMock('@google/generative-ai', () => ({
    GoogleGenerativeAI: class {
      getGenerativeModel = getGenerativeModel
    },
  }))

  return import('./ai')
}

describe('AI availability', () => {
  const original = process.env.GOOGLE_GENERATIVE_AI_API_KEY

  beforeEach(() => {
    getGenerativeModel.mockReset()
    getGenerativeModel.mockReturnValue({
      generateContent: vi.fn().mockResolvedValue({ response: { text: () => '[]' } }),
    })
  })

  afterEach(() => {
    if (original === undefined) delete process.env.GOOGLE_GENERATIVE_AI_API_KEY
    else process.env.GOOGLE_GENERATIVE_AI_API_KEY = original
    vi.doUnmock('@google/generative-ai')
  })

  it('reports disabled when no key is configured', async () => {
    const { isAiEnabled } = await loadAi(undefined)
    expect(isAiEnabled()).toBe(false)
  })

  it('treats an empty key as disabled', async () => {
    // .env.example ships `GOOGLE_GENERATIVE_AI_API_KEY=`, so the blank string is
    // the realistic unconfigured case, not an absent variable.
    const { isAiEnabled } = await loadAi('')
    expect(isAiEnabled()).toBe(false)
  })

  it('reports enabled once a key is present', async () => {
    const { isAiEnabled } = await loadAi('test-key')
    expect(isAiEnabled()).toBe(true)
  })

  it('detectHotspots makes no API call without a key', async () => {
    const { detectHotspots } = await loadAi(undefined)
    await expect(detectHotspots(Buffer.from('png'), 1)).resolves.toEqual([])
    // The point of the guard: a 50-page import used to make 50 doomed requests.
    expect(getGenerativeModel).not.toHaveBeenCalled()
  })

  it('analyzeBookSEO makes no API call without a key', async () => {
    const { analyzeBookSEO } = await loadAi(undefined)
    await expect(analyzeBookSEO([Buffer.from('png')], 'Title')).resolves.toEqual({
      description: '',
      keywords: '',
    })
    expect(getGenerativeModel).not.toHaveBeenCalled()
  })

  it('does reach the model when a key is configured', async () => {
    const { detectHotspots } = await loadAi('test-key')
    await detectHotspots(Buffer.from('png'), 1)
    expect(getGenerativeModel).toHaveBeenCalled()
  })
})

describe('imageMimeType', () => {
  it('labels an image by its bytes, not by assumption', async () => {
    const { imageMimeType } = await import('./ai')
    const webp = Buffer.concat([Buffer.from('RIFF'), Buffer.alloc(4), Buffer.from('WEBPVP8 ')])
    expect(imageMimeType(webp)).toBe('image/webp')
    expect(imageMimeType(Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 0]))).toBe('image/jpeg')
    expect(imageMimeType(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))).toBe('image/png')
    expect(imageMimeType(Buffer.from('GIF89a'))).toBe('image/gif')
  })
})
