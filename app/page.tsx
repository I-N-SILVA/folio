'use client'

import { useEffect } from 'react'
import { LazyMotion, domAnimation } from 'framer-motion'
import { ScrollProgress } from '@/components/landing/ScrollProgress'
import { trackProduct } from '@/lib/product-analytics'

import { Nav } from '@/components/landing/Nav'
import { Hero } from '@/components/landing/Hero'
import { Features } from '@/components/landing/Features'
import { Pricing } from '@/components/landing/Pricing'
import { Faq } from '@/components/landing/Faq'
import { Footer } from '@/components/landing/Footer'

const JSON_LD = {
  '@context': 'https://schema.org',
  '@type': 'SoftwareApplication',
  name: 'QLICO',
  applicationCategory: 'DesignApplication',
  operatingSystem: 'Web',
  url: 'https://qlico.app',
  description:
    'Turn static PDFs into interactive editions with hotspots, analytics, embeds, and brand control.',
  offers: [
    { '@type': 'Offer', name: 'Free', price: '0', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Pro', price: '19', priceCurrency: 'USD' },
    { '@type': 'Offer', name: 'Lifetime', price: '59', priceCurrency: 'USD' },
  ],
}

export default function HomePage() {
  useEffect(() => {
    trackProduct('landing_viewed', { referrer: document.referrer || 'direct' })
  }, [])

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-[#050505] text-white selection:bg-white selection:text-black font-sans">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <ScrollProgress />
        
        <Nav />

        <main>
          <Hero />
          
          <div className="relative z-20 bg-[#050505]">
            <Features />
            <Pricing />
            <Faq />
          </div>
        </main>

        <div className="relative z-20 bg-[#050505]">
          <Footer />
        </div>
      </div>
    </LazyMotion>
  )
}
