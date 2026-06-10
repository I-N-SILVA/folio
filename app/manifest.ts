import type { MetadataRoute } from 'next'

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'Folio — Interactive flipbooks',
    short_name: 'Folio',
    description:
      'Turn static PDFs into immersive, interactive flipbooks with hotspots, analytics, and one-line embeds.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait-primary',
    background_color: '#f6efe2',
    theme_color: '#1b1712',
    categories: ['productivity', 'business', 'books'],
    icons: [
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icon', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
      { src: '/apple-icon', sizes: '180x180', type: 'image/png' },
    ],
    shortcuts: [
      {
        name: 'Open Studio',
        short_name: 'Studio',
        description: 'Jump straight into the Folio editor dashboard.',
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
