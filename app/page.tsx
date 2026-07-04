'use client'

import { LazyMotion, domAnimation } from 'framer-motion'
import { ScrollProgress } from '@/components/landing/ScrollProgress'
import { Nav } from '@/components/landing/Nav'
import { Hero } from '@/components/landing/Hero'
import { FeaturesBento } from '@/components/landing/FeaturesBento'
import { Statement } from '@/components/landing/Statement'
import { Stats } from '@/components/landing/Stats'
import { HowItWorks } from '@/components/landing/HowItWorks'
import { Examples } from '@/components/landing/Examples'
import { Pricing } from '@/components/landing/Pricing'
import { Faq } from '@/components/landing/Faq'
import { ClosingCta } from '@/components/landing/ClosingCta'
import { Footer } from '@/components/landing/Footer'

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
    { '@type': 'Offer', name: 'Lifetime', price: '199', priceCurrency: 'USD' },
  ],
}

export default function HomePage() {
  return (
    <LazyMotion features={domAnimation}>
      <div className="min-h-screen bg-[var(--background)] text-[var(--qlico-ink)]">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(JSON_LD) }}
        />
        <ScrollProgress />
        <Nav />

        <main>
          <Hero />
          <FeaturesBento />
          <Statement />
          <Stats />
          <HowItWorks />
          <Examples />
          <Pricing />
          <Faq />
          <ClosingCta />
        </main>

        <Footer />
      </div>
    </LazyMotion>
  )
}
