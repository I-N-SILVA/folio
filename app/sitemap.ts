import type { MetadataRoute } from 'next'
import { DEMO_BOOKS } from '@/data/books'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://qlico.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date()
  const demoEntries: MetadataRoute.Sitemap = Object.keys(DEMO_BOOKS).map((slug) => ({
    url: `${SITE_URL}/book/${slug}`,
    lastModified: now,
    changeFrequency: 'monthly',
    priority: 0.8,
  }))
  return [
    { url: SITE_URL, lastModified: now, changeFrequency: 'weekly', priority: 1 },
    { url: `${SITE_URL}/login`, lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    ...demoEntries,
    { url: `${SITE_URL}/press`, lastModified: now, changeFrequency: 'monthly', priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
    { url: `${SITE_URL}/terms`, lastModified: now, changeFrequency: 'yearly', priority: 0.3 },
  ]
}
