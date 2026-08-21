'use client'

import { useEffect } from 'react'
import { LazyMotion, domAnimation } from 'framer-motion'
import { ScrollProgress } from '@/components/landing/ScrollProgress'
import { Nav } from '@/components/landing/Nav'
import { BrutalistHero } from '@/components/ui/brutalist-hero'
import { FeaturesBento } from '@/components/landing/FeaturesBento'
import { Pricing } from '@/components/landing/Pricing'
import { Faq } from '@/components/landing/Faq'
import { ClosingCta } from '@/components/landing/ClosingCta'
import { Footer } from '@/components/landing/Footer'
import { trackProduct } from '@/lib/product-analytics'

// Schema.org markup so search results show QLICO as an application with
// pricing. Rendered into the SSR HTML below.
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
  // The denominator for every rate on the landing page. Without it, "signups
  // per week" is a number with nothing to divide by.
  useEffect(() => {
    trackProduct('landing_viewed', { referrer: document.referrer || 'direct' })
  }, [])

  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-[#050505] text-zinc-100 selection:bg-red-500 selection:text-white dark">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <ScrollProgress />
        
        {/* Nav needs to be styled for dark mode or absolute so it overlays the hero */}
        <div className="absolute top-0 left-0 w-full z-50">
          <Nav />
        </div>

        <main>
          <BrutalistHero />
          
          <div className="relative z-20 bg-[#050505]">
            <FeaturesBento />
            <Pricing />
            <Faq />
            <ClosingCta />
          </div>
        </main>

        <div className="bg-black relative z-20">
          <Footer />
        </div>
      </div>
    </LazyMotion>
  )
}
