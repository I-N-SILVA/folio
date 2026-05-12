import { Block, Page } from './book-schema'

export interface PageTemplate {
  id: string
  label: string
  description: string
  icon: string
  blocks: Omit<Block, 'id'>[]
  layout: Page['layout']
}

export const PAGE_TEMPLATES: PageTemplate[] = [
  {
    id: 'editorial-cover',
    label: 'Editorial Cover',
    description: 'Perfect for the first page of your book.',
    icon: 'Layout',
    layout: 'hero',
    blocks: [
      { type: 'text', variant: 'title', content: 'THE NARRATIVE', align: 'center' },
      { type: 'divider' },
      { type: 'text', variant: 'caption', content: 'EST. 2026', align: 'center' },
    ]
  },
  {
    id: 'split-story',
    label: 'Split Story',
    description: 'Balance visuals and storytelling.',
    icon: 'Columns',
    layout: 'split',
    blocks: [
      { type: 'image', src: 'https://images.unsplash.com/photo-1493612276216-ee3925520721?q=80&w=1000', alt: 'Story visual', lightbox: true },
      { type: 'text', variant: 'heading', content: 'Our Vision', align: 'left' },
      { type: 'text', variant: 'body', content: 'Deep in the heart of the narrative, we discover the essential truth of brand architecture and visual storytelling.', align: 'left' },
    ]
  },
  {
    id: 'feature-highlight',
    label: 'Feature',
    description: 'Highlight a specific product or service.',
    icon: 'Star',
    layout: 'text',
    blocks: [
      { type: 'text', variant: 'caption', content: 'HIGHLIGHT', align: 'center' },
      { type: 'text', variant: 'heading', content: 'Premium Experience', align: 'center' },
      { type: 'divider' },
      { type: 'text', variant: 'body', content: 'Experience luxury through our meticulously crafted digital narrative systems.', align: 'center' },
      { type: 'button', label: 'Learn More', href: 'https://example.com', variant: 'primary' },
    ]
  },
  {
    id: 'big-quote',
    label: 'Inspiration',
    description: 'A large, impactful quote.',
    icon: 'Quote',
    layout: 'text',
    blocks: [
      { type: 'text', variant: 'quote', content: 'Design is not just what it looks like and feels like. Design is how it works.', align: 'center' },
      { type: 'text', variant: 'caption', content: '— STEVE JOBS', align: 'center' },
    ]
  },
  {
    id: 'image-focus',
    label: 'Full Image',
    description: 'Let the visual do the talking.',
    icon: 'Image',
    layout: 'blank',
    blocks: [
      { type: 'image', src: 'https://images.unsplash.com/photo-1441974231531-c6227db76b6e?q=80&w=1000', alt: 'Nature', lightbox: true },
    ]
  },
  {
    id: 'stats-grid',
    label: 'Data Grid',
    description: 'Display key metrics or facts.',
    icon: 'Grid',
    layout: 'text',
    blocks: [
      { type: 'text', variant: 'stat', content: '99%', align: 'center' },
      { type: 'text', variant: 'caption', content: 'Satisfaction Rate', align: 'center' },
      { type: 'divider' },
      { type: 'text', variant: 'stat', content: '2.5M', align: 'center' },
      { type: 'text', variant: 'caption', content: 'Active Users', align: 'center' },
    ]
  }
]
