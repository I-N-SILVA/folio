/**
 * The wordmark, inlined rather than fetched.
 *
 * `<Image src="/brand/logo-dark.svg">` does not work: next/image routes even a
 * local file through `/_next/image`, which answers 400 "image type is not
 * allowed" for SVG unless `images.dangerouslyAllowSVG` is set. That flag is not
 * set on purpose — `*.supabase.co` is in `remotePatterns` and authors upload
 * images there, so allowing SVG through the optimiser would serve a
 * user-supplied SVG, scripts and all. Inlining costs nothing, renders with no
 * request and no layout shift, and takes its colour from the surface.
 *
 * The wordmark inherits its colour. It used to force `--foreground`, which is
 * black in light mode — and in the footer, which sets `text-white` on a #050505
 * ground, that rendered the brand mark black on black. `currentColor` means it
 * is whatever the surface it sits on has already decided text should be.
 */
/** The monogram on its own, for places with no room for the wordmark. */
export function MarkSymbol({ size = 26, className = '' }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 512 512"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`shrink-0 text-current ${className}`}
      aria-hidden
    >
      <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
        <path d="M 140 170 C 200 120 312 120 372 170" strokeWidth="44" />
        <path d="M 110 256 H 402" strokeWidth="44" />
        <path d="M 170 342 H 420" strokeWidth="44" />
        <circle cx="256" cy="256" r="14" fill="currentColor" stroke="none" />
      </g>
    </svg>
  )
}

export function Mark({
  className = '',
  /** Symbol size in px. The wordmark scales with `wordClassName`. */
  size = 26,
  wordClassName = 'text-2xl',
}: {
  className?: string
  size?: number
  wordClassName?: string
}) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <MarkSymbol size={size} />
      <span className={`font-display font-black tracking-tighter text-current ${wordClassName}`}>
        QLICO
      </span>
    </div>
  )
}
