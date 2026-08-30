import type { MetadataRoute } from 'next'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://qlico.app'

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: [
          '/api/',
          '/dashboard/',
          '/editor/',
          '/account/',
          '/redeem/',
          '/auth/',
        ],
      },
      // Explicitly welcome AI & Answer Search Crawlers for AEO
      {
        userAgent: [
          'Googlebot',
          'Bingbot',
          'Applebot',
          'GPTBot',
          'ChatGPT-User',
          'Claude-Web',
          'ClaudeBot',
          'PerplexityBot',
          'OAI-SearchBot',
        ],
        allow: ['/', '/book/*', '/help', '/press', '/terms', '/privacy', '/llms.txt'],
        disallow: ['/api/', '/dashboard/', '/editor/', '/account/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
