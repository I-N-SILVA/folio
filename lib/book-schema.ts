import { z } from 'zod'

// ─── Block Schemas ─────────────────────────────────────────────────────────────

export const TextBlockSchema = z.object({
  type: z.literal('text'),
  id: z.string(),
  variant: z.enum(['title', 'heading', 'body', 'caption', 'quote', 'stat']),
  content: z.string(),
  align: z.enum(['left', 'center', 'right']).optional(),
  textColor: z.string().optional(),
  fontSize: z.enum(['xs', 'sm', 'base', 'lg', 'xl', '2xl', '4xl', '6xl']).optional(),
  backgroundColor: z.string().optional(),
  padding: z.enum(['none', 'sm', 'md', 'lg']).optional(),
  borderRadius: z.enum(['none', 'sm', 'md', 'lg', 'full']).optional(),
  letterSpacing: z.enum(['tighter', 'tight', 'normal', 'wide', 'widest']).optional(),
})

export const ImageBlockSchema = z.object({
  type: z.literal('image'),
  id: z.string(),
  src: z.string().refine((s) => {
    try {
      const url = new URL(s)
      return url.protocol === 'http:' || url.protocol === 'https:' || url.protocol === 'data:'
    } catch {
      return s.startsWith('/') || s.startsWith('data:')
    }
  }, { message: 'Must be a valid URL or data URI' }),
  alt: z.string(),
  caption: z.string().optional(),
  lightbox: z.boolean().optional(),
  aspectRatio: z.enum(['auto', '1/1', '16/9', '4/3', '3/4', '2/3', '21/9']).optional(),
  width: z.enum(['full', '3/4', '1/2', '1/3', '1/4']).optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
  maxHeight: z.enum(['none', 'xs', 'sm', 'md', 'lg', 'xl']).optional(),
  borderRadius: z.enum(['none', 'sm', 'md', 'lg', 'xl', 'full']).optional(),
  objectFit: z.enum(['cover', 'contain', 'fill']).optional(),
  shadow: z.enum(['none', 'sm', 'md', 'lg', '2xl']).optional(),
  border: z.boolean().optional(),
  borderColor: z.string().optional(),
  focalPoint: z.enum(['center', 'top', 'bottom', 'left', 'right']).optional(),
})

export const VideoBlockSchema = z.object({
  type: z.literal('video'),
  id: z.string(),
  src: z.string().url(),
  poster: z.string().url(),
  autoplay: z.literal(false).default(false),
  muted: z.literal(true).default(true),
})

export const AudioBlockSchema = z.object({
  type: z.literal('audio'),
  id: z.string(),
  src: z.string().url(),
  title: z.string(),
  waveform: z.boolean().optional().default(false),
})

export const ButtonBlockSchema = z.object({
  type: z.literal('button'),
  id: z.string(),
  label: z.string(),
  href: z.string().url(),
  variant: z.enum(['primary', 'secondary', 'ghost']),
  shape: z.enum(['pill', 'rounded', 'square']).optional(),
  size: z.enum(['sm', 'md', 'lg']).optional(),
  fullWidth: z.boolean().optional(),
  customColor: z.string().optional(),
  textColor: z.string().optional(),
  target: z.literal('_blank').optional().default('_blank'),
})

export const DividerBlockSchema = z.object({
  type: z.literal('divider'),
  id: z.string(),
})

export const EmbedBlockSchema = z.object({
  type: z.literal('embed'),
  id: z.string(),
  html: z.string(),
  height: z.number(),
})

// Living editions — a value bound to a JSON source that updates after publish.
export const DataBlockSchema = z.object({
  type: z.literal('data'),
  id: z.string(),
  label: z.string(),
  source: z.string(), // JSON endpoint (absolute URL or same-origin path)
  path: z.string(), // dot-path into the JSON, e.g. "product.price"
  prefix: z.string().optional(),
  suffix: z.string().optional(),
  fallback: z.string().optional(),
  align: z.enum(['left', 'center', 'right']).optional(),
})

// Shoppable product grid & multi-item row for lookbooks and catalogs.
export const ProductItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  price: z.string(),
  originalPrice: z.string().optional(),
  image: z.string(),
  alt: z.string().optional(),
  description: z.string().optional(),
  buyUrl: z.string().optional(),
  ctaLabel: z.string().optional().default('Add to Bag'),
  action: z.enum(['cart', 'checkout', 'link']).default('cart').optional(),
  badge: z.string().optional(),
  inStock: z.boolean().default(true).optional(),
})

export const ProductGridBlockSchema = z.object({
  type: z.literal('product-grid'),
  id: z.string(),
  columns: z.enum(['2', '3', '4']).default('2'),
  items: z.array(ProductItemSchema).default([]),
  cardStyle: z.enum(['minimal', 'bordered', 'elevated', 'glass']).default('bordered').optional(),
  aspectRatio: z.enum(['1/1', '3/4', '4/3', '16/9']).default('1/1').optional(),
})

export const BlockSchema = z.discriminatedUnion('type', [
  TextBlockSchema,
  ImageBlockSchema,
  VideoBlockSchema,
  AudioBlockSchema,
  ButtonBlockSchema,
  DividerBlockSchema,
  EmbedBlockSchema,
  DataBlockSchema,
  ProductGridBlockSchema,
])

// ─── Hotspot Schema ────────────────────────────────────────────────────────────

export const HotspotMediaSchema = z.object({
  type: z.enum(['image', 'video']),
  src: z.string().url(),
  alt: z.string().optional(),
  poster: z.string().url().optional(),
})

export const HotspotSchema = z.object({
  id: z.string(),
  x: z.number().min(0).max(100),
  y: z.number().min(0).max(100),
  label: z.string(),
  icon: z.string().default('Info'),
  beaconStyle: z.enum(['pulse', 'shopping', 'audio', 'step', 'minimal']).default('pulse').optional(),
  stepNumber: z.number().int().min(1).max(99).optional(),
  pinColor: z.string().optional(),
  modal: z.object({
    title: z.string(),
    body: z.string(), // markdown
    media: HotspotMediaSchema.optional(),
  }),
  action: z.enum(['modal', 'link', 'checkout']).default('modal'),
  linkUrl: z.string().url().optional(),
  stripeUrl: z.string().url().optional(),
  price: z.string().optional(),
  ctaLabel: z.string().optional(),
})

// ─── Page Schema ───────────────────────────────────────────────────────────────

export const BackgroundSchema = z.object({
  color: z.string().optional(),
  image: z.string().optional(),
  imagePosition: z.enum(['center', 'top', 'bottom', 'left', 'right']).optional(),
  imageFit: z.enum(['cover', 'contain', 'auto']).optional(),
  overlay: z.string().optional(), // rgba color or dark tint hex
  overlayOpacity: z.number().min(0).max(100).optional(),
  blur: z.enum(['none', 'sm', 'md', 'lg']).optional(),
  paperTexture: z.enum(['none', 'gloss', 'matte', 'washi', 'linen', 'carbon']).default('none').optional(),
})

export const AmbientAudioSchema = z.object({
  src: z.string().url(),
  loop: z.boolean().default(true),
  volume: z.number().min(0).max(1).default(0.5),
  title: z.string().optional(),
})

export const PageSchema = z.object({
  id: z.string(),
  book_id: z.string(),
  page_number: z.number().int().positive(),
  type: z.enum(['cover', 'content', 'back']),
  layout: z.enum(['hero', 'split', 'text', 'grid', 'blank']),
  background: BackgroundSchema.optional(),
  blocks: z.array(BlockSchema).default([]),
  hotspots: z.array(HotspotSchema).default([]),
  ambientAudio: AmbientAudioSchema.optional(),
})

// ─── Theme Schema ──────────────────────────────────────────────────────────────

export const ThemeSchema = z.object({
  preset: z.enum(['ivory', 'slate', 'cream', 'carbon', 'sage', 'custom']).default('ivory'),
  background: z.string().optional(),
  primary: z.string().optional(),
  headingFont: z.string().optional(),
  bodyFont: z.string().optional(),
  paperPhysics: z.enum(['magazine', 'hardcover', 'washi']).default('magazine').optional(),
  paperTexture: z.enum(['none', 'gloss', 'matte', 'washi', 'linen', 'carbon']).default('none').optional(),
})

// ─── Book Settings Schema ──────────────────────────────────────────────────────

export const GatingSchema = z.object({
  enabled: z.boolean().default(false),
  page_number: z.number().default(3),
  type: z.enum(['email', 'passcode', 'domain']).default('email'),
  title: z.string().default('Unlock the full version'),
  description: z.string().default('Enter your credentials to continue reading.'),
  passcode: z.string().optional(),
  allowedDomains: z.array(z.string()).optional(),
  webhookUrl: z.string().optional(),
})

export const SEOSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.string().optional(),
})

export const BookSettingsSchema = z.object({
  published: z.boolean().default(false),
  unlisted: z.boolean().default(false),
  gating: GatingSchema.default({
    enabled: false,
    page_number: 3,
    type: 'email',
    title: 'Unlock the full version',
    description: 'Enter your email to continue reading.',
  }),
  seo: SEOSchema.optional(),
  whitelabel: z.boolean().default(false),
  webhookUrl: z.string().optional(),
  customDomain: z.string().optional(),
})

// ─── Book Schema ───────────────────────────────────────────────────────────────

export const BookSchema = z.object({
  id: z.string(),
  slug: z.string().min(1).max(100).regex(/^[a-z0-9-]+$/),
  title: z.string().min(1).max(200),
  description: z.string().optional(),
  owner_id: z.string(),
  theme: ThemeSchema.default({ preset: 'ivory' }),
  settings: BookSettingsSchema.default({
    published: false,
    unlisted: false,
    gating: {
      enabled: false,
      page_number: 3,
      type: 'email',
      title: 'Unlock the full version',
      description: 'Enter your email to continue reading.',
    },
    whitelabel: false,
  }),
  created_at: z.string().optional(),
  updated_at: z.string().optional(),
  pages: z.array(PageSchema).optional(),
})

// ─── TypeScript types ──────────────────────────────────────────────────────────

export type TextBlock = z.infer<typeof TextBlockSchema>
export type ImageBlock = z.infer<typeof ImageBlockSchema>
export type VideoBlock = z.infer<typeof VideoBlockSchema>
export type AudioBlock = z.infer<typeof AudioBlockSchema>
export type ButtonBlock = z.infer<typeof ButtonBlockSchema>
export type DividerBlock = z.infer<typeof DividerBlockSchema>
export type EmbedBlock = z.infer<typeof EmbedBlockSchema>
export type DataBlock = z.infer<typeof DataBlockSchema>
export type ProductItem = z.infer<typeof ProductItemSchema>
export type ProductGridBlock = z.infer<typeof ProductGridBlockSchema>
export type Block = z.infer<typeof BlockSchema>
export type Hotspot = z.infer<typeof HotspotSchema>
export type Page = z.infer<typeof PageSchema>
export type Background = z.infer<typeof BackgroundSchema>
export type Theme = z.infer<typeof ThemeSchema>
export type Gating = z.infer<typeof GatingSchema>
export type BookSettings = z.infer<typeof BookSettingsSchema>
export type Book = z.infer<typeof BookSchema>

// ─── Analytics event types ─────────────────────────────────────────────────────

export type EventType =
  | 'book_open'
  | 'page_view'
  | 'page_flip'
  | 'hotspot_click'
  | 'modal_open'
  | 'modal_close'
  | 'video_play'
  | 'video_complete'
  | 'audio_play'
  | 'cta_click'
  | 'book_complete'
  | 'page_click' // New for Heatmaps
  | 'gate_view' // Reader reached the lead gate
  | 'gate_unlock' // New for Gating

// ─── Theme presets ─────────────────────────────────────────────────────────────

export const THEME_PRESETS = {
  ivory: {
    label: 'Ivory',
    background: '#F7F6F2',
    primary: '#01696F',
    headingFont: 'Playfair Display',
    bodyFont: 'Inter',
  },
  slate: {
    label: 'Slate',
    background: '#1C1C2E',
    primary: '#7C6EF8',
    headingFont: 'Sora',
    bodyFont: 'Inter',
  },
  cream: {
    label: 'Cream',
    background: '#FFFBF0',
    primary: '#C84B31',
    headingFont: 'Lora',
    bodyFont: 'Source Serif 4',
  },
  carbon: {
    label: 'Carbon',
    background: '#111111',
    primary: '#F5F5F5',
    headingFont: 'Space Grotesk',
    bodyFont: 'IBM Plex Sans',
  },
  sage: {
    label: 'Sage',
    background: '#F0F4F0',
    primary: '#2D6A4F',
    headingFont: 'DM Serif Display',
    bodyFont: 'DM Sans',
  },
} as const
