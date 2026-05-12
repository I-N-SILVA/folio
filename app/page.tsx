'use client'

import dynamic from 'next/dynamic'
import Link from 'next/link'
import {
  BookOpen,
  BarChart2,
  Target,
  FileUp,
  Code2,
  Palette,
  Check,
} from 'lucide-react'

// Lazy-loaded browser mock with iframe — avoids SSR iframe issues
const BrowserPreview = dynamic(() => import('@/components/landing/BrowserPreview'), {
  ssr: false,
  loading: () => (
    <div className="w-full aspect-[16/9] rounded-xl bg-[#F7F6F2] border border-gray-200 animate-pulse" />
  ),
})

// ─── Data ──────────────────────────────────────────────────────────────────────

const FEATURES = [
  {
    icon: BookOpen,
    title: 'Page flip animation',
    desc: 'Buttery smooth CSS 3D page turns on desktop and mobile.',
  },
  {
    icon: BarChart2,
    title: 'Built-in analytics',
    desc: 'Track opens, dwell time, hotspot clicks, and completion funnels. Your data stays in your Supabase.',
  },
  {
    icon: Target,
    title: 'Interactive hotspots',
    desc: 'Place clickable info points anywhere on a page. Opens a rich modal with text, images, or video.',
  },
  {
    icon: FileUp,
    title: 'PDF import',
    desc: 'Upload any PDF and get an interactive flipbook in seconds.',
  },
  {
    icon: Code2,
    title: 'Embed anywhere',
    desc: 'One line of HTML to embed your book in any website or CMS.',
  },
  {
    icon: Palette,
    title: '5 beautiful themes',
    desc: 'Ivory, Slate, Cream, Carbon, Sage — or customize your own.',
  },
]

const STEPS = [
  {
    num: '01',
    title: 'Create',
    desc: 'Set up a book with our form-based Studio. No code, no JSON.',
  },
  {
    num: '02',
    title: 'Publish',
    desc: 'Hit publish. Your book is live at a shareable URL instantly.',
  },
  {
    num: '03',
    title: 'Analyse',
    desc: 'Open the analytics dashboard to see how readers engage with every page.',
  },
]

const PLANS = [
  {
    name: 'Free',
    price: null,
    highlight: false,
    cta: 'Start free',
    features: ['1 book', 'Basic analytics (7 days)', 'Folio watermark'],
  },
  {
    name: 'Pro',
    price: '$19/mo',
    highlight: true,
    cta: 'Start Pro',
    features: [
      'Unlimited books',
      'Full analytics (90 days)',
      'Custom domain',
      'No watermark',
      'CSV export',
    ],
  },
  {
    name: 'Self-hosted',
    price: '$199 one-time',
    highlight: false,
    cta: 'Get license',
    features: [
      'Everything in Pro',
      'Your infrastructure',
      'Data sovereignty',
      'PDF import',
    ],
  },
]

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function HomePage() {
  return (
    <div className="min-h-screen bg-white text-gray-900" style={{ fontFamily: 'var(--font-inter), sans-serif' }}>

      {/* ── Nav ─────────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 bg-white/90 backdrop-blur border-b border-gray-100">
        <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link href="/" className="text-xl font-bold tracking-tight text-gray-900">
            Folio
          </Link>
          <nav className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/book/demo"
              className="hidden sm:block text-sm text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5"
            >
              View Demo
            </Link>
            <Link
              href="/login"
              className="text-sm text-gray-600 hover:text-gray-900 transition-colors px-3 py-1.5"
            >
              Sign In
            </Link>
            <Link
              href="/login"
              className="text-sm font-medium text-white px-4 py-2 rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#01696F' }}
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section id="hero" className="pt-20 pb-16 px-6" style={{ backgroundColor: '#F7F6F2' }}>
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-gray-900 leading-[1.1]">
            Interactive flipbooks<br className="hidden sm:block" />{' '}
            that tell your story
          </h1>
          <p className="mt-6 text-lg sm:text-xl text-gray-600 max-w-2xl mx-auto leading-relaxed">
            Build beautiful page-flip experiences with analytics, hotspots, and embeds.
            Self-hosted — your content, your data.
          </p>
          <div className="mt-8 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Link
              href="/login"
              className="w-full sm:w-auto text-center text-base font-medium text-white px-7 py-3 rounded-lg transition-opacity hover:opacity-90"
              style={{ backgroundColor: '#01696F' }}
            >
              Start for free
            </Link>
            <Link
              href="/book/demo"
              className="w-full sm:w-auto text-center text-base font-medium text-gray-700 px-7 py-3 rounded-lg border border-gray-300 bg-white hover:border-gray-400 transition-colors"
            >
              See the demo →
            </Link>
          </div>

          {/* Browser mock */}
          <div className="mt-14 max-w-3xl mx-auto">
            <div className="rounded-xl border border-gray-200 overflow-hidden shadow-xl bg-white">
              {/* Browser chrome */}
              <div className="flex items-center gap-1.5 px-4 py-3 bg-gray-50 border-b border-gray-200">
                <span className="w-3 h-3 rounded-full bg-red-400" />
                <span className="w-3 h-3 rounded-full bg-yellow-400" />
                <span className="w-3 h-3 rounded-full bg-green-400" />
                <div className="ml-3 flex-1 bg-white border border-gray-200 rounded text-xs text-gray-400 px-3 py-1 text-left max-w-xs">
                  folio.app/book/demo
                </div>
              </div>
              {/* Iframe content */}
              <div className="aspect-[16/9] bg-[#F7F6F2]">
                <BrowserPreview />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-20 px-6 bg-white">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              Everything a flipbook needs
            </h2>
            <p className="mt-3 text-gray-500 text-lg">
              Built for creators who want full control without complexity.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {FEATURES.map(({ icon: Icon, title, desc }) => (
              <div
                key={title}
                className="p-6 rounded-xl border border-gray-100 bg-[#F7F6F2] hover:border-gray-200 transition-colors"
              >
                <div
                  className="w-10 h-10 rounded-lg flex items-center justify-center mb-4"
                  style={{ backgroundColor: 'rgba(1,105,111,0.1)' }}
                >
                  <Icon size={20} style={{ color: '#01696F' }} />
                </div>
                <h3 className="font-semibold text-gray-900 mb-1">{title}</h3>
                <p className="text-sm text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How it works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="py-20 px-6" style={{ backgroundColor: '#F7F6F2' }}>
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              How it works
            </h2>
            <p className="mt-3 text-gray-500 text-lg">
              From zero to published in under five minutes.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {STEPS.map(({ num, title, desc }) => (
              <div key={num} className="relative">
                <div
                  className="text-5xl font-bold mb-3 leading-none"
                  style={{ color: 'rgba(1,105,111,0.15)' }}
                >
                  {num}
                </div>
                <h3 className="text-xl font-semibold text-gray-900 mb-2">{title}</h3>
                <p className="text-gray-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Pricing ─────────────────────────────────────────────────────────── */}
      <section id="pricing" className="py-20 px-6 bg-white">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-14">
            <h2 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              Simple pricing
            </h2>
            <p className="mt-3 text-gray-500 text-lg">
              Start free. Scale when you need it.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {PLANS.map(({ name, price, highlight, cta, features }) => (
              <div
                key={name}
                className={`relative rounded-2xl border p-8 flex flex-col ${
                  highlight
                    ? 'border-transparent text-white shadow-lg'
                    : 'border-gray-200 bg-white'
                }`}
                style={highlight ? { backgroundColor: '#01696F' } : {}}
              >
                {highlight && (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 bg-amber-400 text-amber-900 text-xs font-semibold px-3 py-1 rounded-full">
                    Most popular
                  </div>
                )}
                <div className="mb-6">
                  <h3
                    className={`text-lg font-semibold mb-1 ${
                      highlight ? 'text-white' : 'text-gray-900'
                    }`}
                  >
                    {name}
                  </h3>
                  {price ? (
                    <p
                      className={`text-2xl font-bold ${
                        highlight ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      {price}
                    </p>
                  ) : (
                    <p
                      className={`text-2xl font-bold ${
                        highlight ? 'text-white' : 'text-gray-900'
                      }`}
                    >
                      Free
                    </p>
                  )}
                </div>
                <ul className="flex-1 space-y-3 mb-8">
                  {features.map((f) => (
                    <li key={f} className="flex items-start gap-2 text-sm">
                      <Check
                        size={16}
                        className={`mt-0.5 shrink-0 ${
                          highlight ? 'text-white/80' : ''
                        }`}
                        style={highlight ? {} : { color: '#01696F' }}
                      />
                      <span className={highlight ? 'text-white/90' : 'text-gray-600'}>
                        {f}
                      </span>
                    </li>
                  ))}
                </ul>
                <Link
                  href="/login"
                  className={`text-center text-sm font-semibold py-3 rounded-lg transition-colors ${
                    highlight
                      ? 'bg-white hover:bg-gray-50 text-[#01696F]'
                      : 'border border-gray-300 hover:border-gray-400 text-gray-800'
                  }`}
                >
                  {cta}
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-100 py-12 px-6" style={{ backgroundColor: '#F7F6F2' }}>
        <div className="max-w-6xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-6">
          <div className="text-center sm:text-left">
            <p className="text-lg font-bold text-gray-900">Folio</p>
            <p className="text-sm text-gray-500 mt-0.5">Self-hosted interactive flipbooks</p>
          </div>
          <nav className="flex items-center gap-6 text-sm text-gray-500">
            <Link href="/book/demo" className="hover:text-gray-900 transition-colors">
              Demo
            </Link>
            <Link href="/login" className="hover:text-gray-900 transition-colors">
              Sign in
            </Link>
            <a
              href="https://github.com"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-gray-900 transition-colors"
            >
              GitHub
            </a>
          </nav>
          <p className="text-xs text-gray-400">Built with Next.js + Supabase</p>
        </div>
      </footer>
    </div>
  )
}
