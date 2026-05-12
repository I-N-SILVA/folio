import { z } from 'zod'

// ─── Block Schemas ─────────────────────────────────────────────────────────────

export const TextBlockSchema = z.object({
  type: z.literal('text'),
  id: z.string(),
  variant: z.enum(['title', 'heading', 'body', 'caption', 'quote', 'stat']),
  content: z.string(),
  align: z.enum(['left', 'center', 'right']).optional(),
})

export const ImageBlockSchema = z.object({
  type: z.literal('image'),
  id: z.string(),
  src: z.string().url(),
  alt: z.string(),
  caption: z.string().optional(),
  lightbox: z.boolean().optional().default(false),
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

export const BlockSchema = z.discriminatedUnion('type', [
  TextBlockSchema,
  ImageBlockSchema,
  VideoBlockSchema,
  AudioBlockSchema,
  ButtonBlockSchema,
  DividerBlockSchema,
  EmbedBlockSchema,
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
  modal: z.object({
    title: z.string(),
    body: z.string(), // markdown
    media: HotspotMediaSchema.optional(),
  }),
  action: z.enum(['modal', 'link', 'checkout']).default('modal'),
  linkUrl: z.string().url().optional(),
  stripeUrl: z.string().url().optional(),
})

// ─── Page Schema ───────────────────────────────────────────────────────────────

export const BackgroundSchema = z.object({
  color: z.string().optional(),
  image: z.string().url().optional(),
  imagePosition: z.enum(['center', 'top', 'bottom', 'left', 'right']).optional(),
  overlay: z.string().optional(), // rgba color for image overlay
})

export const PageSchema = z.object({
  id: z.string(),
  book_id: z.string(),
  page_number: z.number().int().positive(),
  type: z.enum(['cover', 'content', 'back']),
  layout: z.enum(['hero', 'split', 'text', 'blank']),
  background: BackgroundSchema.optional(),
  blocks: z.array(BlockSchema).default([]),
  hotspots: z.array(HotspotSchema).default([]),
})

// ─── Theme Schema ──────────────────────────────────────────────────────────────

export const ThemeSchema = z.object({
  preset: z.enum(['ivory', 'slate', 'cream', 'carbon', 'sage', 'custom']).default('ivory'),
  background: z.string().optional(),
  primary: z.string().optional(),
  headingFont: z.string().optional(),
  bodyFont: z.string().optional(),
})

// ─── Book Settings Schema ──────────────────────────────────────────────────────

export const GatingSchema = z.object({
  enabled: z.boolean().default(false),
  page_number: z.number().default(3),
  type: z.enum(['email', 'password']).default('email'),
  title: z.string().default('Unlock the full version'),
  description: z.string().default('Enter your email to continue reading.'),
})

export const SEOSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional(),
  keywords: z.string().optional(),
})

export const BookSettingsSchema = z.object({
  published: z.boolean().default(false),
  unlisted: z.boolean().default(false),
  password: z.string().optional(),
  gating: GatingSchema.default({
    enabled: false,
    page_number: 3,
    type: 'email',
    title: 'Unlock the full version',
    description: 'Enter your email to continue reading.',
  }),
  burn_after_reading: z.boolean().default(false),
  seo: SEOSchema.optional(),
  whitelabel: z.boolean().default(false),
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
    burn_after_reading: false,
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
