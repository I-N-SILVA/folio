import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
import { AppleSplashLinks } from '@/components/AppleSplashLinks'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://riffle.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Riffle — Flip through anything', template: '%s | Riffle' },
  description:
    'Riffle turns static PDFs into interactive editions with hotspots, analytics, embeds, and brand control. Built for catalogs, lookbooks, portfolios, and reports.',
  applicationName: 'Riffle',
  keywords: [
    'interactive publishing',
    'interactive PDF',
    'digital publishing',
    'flipbook',
    'lookbook',
    'catalog',
    'portfolio',
    'embeddable reader',
  ],
  authors: [{ name: 'Riffle' }],
  creator: 'Riffle',
  publisher: 'Riffle',
  alternates: { canonical: '/' },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Riffle',
    title: 'Riffle — Flip through anything',
    description:
      'Turn static PDFs into interactive editions with hotspots, analytics, and one-line embeds.',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Riffle — Flip through anything',
    description:
      'Turn static PDFs into interactive editions with hotspots, analytics, and one-line embeds.',
  },
  appleWebApp: {
    capable: true,
    title: 'Riffle',
    statusBarStyle: 'default',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#1d1d1f' },
  ],
  colorScheme: 'light',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col font-sans">
        <AppleSplashLinks />
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
