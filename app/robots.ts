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
          '/insights/',
          '/account/',
          '/redeem/',
          '/auth/',
          // A review link's URL *is* its credential. The page itself sends
          // `noindex`, which is the control that actually binds; this is the
          // belt to that pair of braces, and keeps drafts out of a crawl even
          // before the page is fetched.
          '/review/',
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
        disallow: ['/api/', '/dashboard/', '/editor/', '/insights/', '/account/', '/review/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  }
}
