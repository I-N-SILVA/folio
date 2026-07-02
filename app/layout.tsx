import type { Metadata, Viewport } from 'next'
import { DM_Sans, Fraunces } from 'next/font/google'
import { Providers } from './providers'
import { ServiceWorkerRegistrar } from '@/components/ServiceWorkerRegistrar'
import { AppleSplashLinks } from '@/components/AppleSplashLinks'
import './globals.css'

const bodyFont = DM_Sans({ subsets: ['latin'], variable: '--font-body', display: 'swap' })
// Fraunces at high optical size, soft terminals, wonky alternates on — the
// ownable display voice. The axes ship in the variable font; tune via CSS
// (font-variation-settings in globals.css).
const displayFont = Fraunces({
  subsets: ['latin'],
  variable: '--font-display',
  display: 'swap',
  axes: ['SOFT', 'WONK', 'opsz'],
})

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL || 'https://klicko.app'

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: { default: 'KLICKO — Flip through anything', template: '%s | KLICKO' },
  description:
    'KLICKO turns static PDFs into interactive editions with hotspots, analytics, embeds, and brand control. Built for catalogs, lookbooks, portfolios, and reports.',
  applicationName: 'KLICKO',
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
  authors: [{ name: 'KLICKO' }],
  creator: 'KLICKO',
  publisher: 'KLICKO',
  alternates: { canonical: '/' },
  manifest: '/manifest.webmanifest',
  openGraph: {
    type: 'website',
    url: SITE_URL,
    siteName: 'KLICKO',
    title: 'KLICKO — Flip through anything',
    description:
      'Turn static PDFs into interactive editions with hotspots, analytics, and one-line embeds.',
    locale: 'en_US',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'KLICKO — Flip through anything',
    description:
      'Turn static PDFs into interactive editions with hotspots, analytics, and one-line embeds.',
  },
  appleWebApp: {
    capable: true,
    title: 'KLICKO',
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
    <html lang="en" className={`h-full antialiased ${bodyFont.variable} ${displayFont.variable}`}>
      <body className="min-h-full flex flex-col font-sans">
        <AppleSplashLinks />
        <Providers>{children}</Providers>
        <ServiceWorkerRegistrar />
      </body>
    </html>
  )
}
