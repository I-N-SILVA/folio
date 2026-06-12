import type { Metadata, Viewport } from 'next'
import { Providers } from './providers'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
import './globals.css'

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://folio.new'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'Folio — Interactive flipbooks with soul', template: '%s | Folio' },
  description:
    'Folio turns static PDFs into immersive, interactive flipbooks with hotspots, analytics, embeds, and brand control. Built for portfolios, catalogs, lookbooks, reports, and premium stories.',
  applicationName: 'Folio',
  keywords: [
    'flipbook',
    'interactive PDF',
    'digital publishing',
    'lookbook',
    'catalog',
    'portfolio',
    'embeddable reader',
    'PDF to flipbook',
  ],
  authors: [{ name: 'Folio' }],
  creator: 'Folio',
  publisher: 'Folio',
  alternates: { canonical: '/' },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'Folio',
    title: 'Folio — Interactive flipbooks with soul',
    description:
      'Turn static PDFs into immersive, interactive flipbooks with hotspots, analytics, and one-line embeds.',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Folio — Interactive flipbooks with soul',
    description:
      'Turn static PDFs into immersive, interactive flipbooks with hotspots, analytics, and one-line embeds.',
  },
  appleWebApp: {
    capable: true,
    title: 'Folio',
    statusBarStyle: 'black-translucent',
  },
  formatDetection: { telephone: false },
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#f6efe2' },
    { media: '(prefers-color-scheme: dark)', color: '#1b1712' },
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
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
