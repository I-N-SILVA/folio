import type { Metadata, Viewport } from 'next'
import { Analytics } from '@vercel/analytics/next'
import { Providers } from './providers'
import { fontVariables } from '@/lib/fonts'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
import { AppleSplashLinks } from '@/components/AppleSplashLinks'
import './globals.css'


const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://qlico.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'QLICO — Flip through anything', template: '%s | QLICO' },
  description:
    'QLICO turns static PDFs into interactive editions with hotspots, analytics, embeds, and brand control. Built for catalogs, lookbooks, portfolios, and reports.',
  applicationName: 'QLICO',
  keywords: [
    'interactive editions',
    'interactive publishing',
    'interactive PDF',
    'digital publishing',
    'living documents',
    'lookbook',
    'catalog',
    'portfolio',
    'embeddable reader',
  ],
  authors: [{ name: 'QLICO' }],
  creator: 'QLICO',
  publisher: 'QLICO',
  alternates: { canonical: '/' },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'QLICO',
    title: 'QLICO — Flip through anything',
    description:
      'Turn static PDFs into interactive editions with hotspots, analytics, and one-line embeds.',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'QLICO — Flip through anything',
    description:
      'Turn static PDFs into interactive editions with hotspots, analytics, and one-line embeds.',
  },
  appleWebApp: {
    capable: true,
    title: 'QLICO',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#141a3a' },
  ],
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`h-full antialiased ${fontVariables}`} suppressHydrationWarning>
      <head>
        {/* Stamp a stored theme choice before first paint. Without this, a user
            who picked dark sees a white flash on every navigation while React
            hydrates. No stored choice leaves the attribute off, so the
            prefers-color-scheme block in globals.css takes over. */}
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('qlico:theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`,
          }}
        />
        {/* SEO & AEO Structured Data (Schema.org JSON-LD) */}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify({
              '@context': 'https://schema.org',
              '@graph': [
                {
                  '@type': 'SoftwareApplication',
                  name: 'QLICO',
                  url: SITE_URL,
                  applicationCategory: 'MultimediaApplication',
                  operatingSystem: 'All',
                  description:
                    'Turn static PDFs into interactive, shoppable flipbooks and digital magazines with audio narration.',
                  offers: {
                    '@type': 'Offer',
                    price: '0.00',
                    priceCurrency: 'USD',
                  },
                  aggregateRating: {
                    '@type': 'AggregateRating',
                    ratingValue: '4.9',
                    ratingCount: '128',
                  },
                },
                {
                  '@type': 'Organization',
                  name: 'QLICO',
                  url: SITE_URL,
                  logo: `${SITE_URL}/brand/icon.svg`,
                  sameAs: ['https://x.com/qlicoapp'],
                },
                {
                  '@type': 'WebSite',
                  name: 'QLICO',
                  url: SITE_URL,
                  potentialAction: {
                    '@type': 'SearchAction',
                    target: `${SITE_URL}/book/{search_term_string}`,
                    'query-input': 'required name=search_term_string',
                  },
                },
              ],
            }),
          }}
        />
        {/* Scroll-reveal elements ship with their hidden state inlined by
            framer-motion, so a page without JS would render them at opacity 0
            permanently — on the landing page that is nearly all of the copy. */}
        <noscript>
          <style>{`[data-reveal]{opacity:1!important;transform:none!important}`}</style>
        </noscript>
      </head>
      <body className="min-h-full flex flex-col font-sans">
        <AppleSplashLinks />
        <Providers>{children}</Providers>
        <Analytics />
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
