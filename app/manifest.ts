import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'KLICKO — Interactive publishing',
    short_name: 'KLICKO',
    description:
      'Turn static PDFs into interactive editions with hotspots, analytics, and one-line embeds.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#ffffff',
    theme_color: '#3c2384',
    categories: ['productivity', 'business', 'books'],
    icons: [
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/brand/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/brand/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/brand/apple-icon-180.png', sizes: '180x180', type: 'image/png' },
    ],
    shortcuts: [
      {
        name: 'Open Studio',
        short_name: 'Studio',
        description: 'Jump straight into the KLICKO editor dashboard.',
        url: '/dashboard',
      },
      {
        name: 'Create a folio',
        short_name: 'Create',
        description: 'Start a new interactive publication.',
        url: '/create',
      },
    ],
  }
}
