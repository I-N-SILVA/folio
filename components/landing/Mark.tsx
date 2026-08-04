import Image from 'next/image'

/**
 * The lockup ships as two rasters — the wordmark's navy is baked in, so on a
 * dark background the type disappears and only the violet mark survives. Both
 * are rendered and CSS picks one, which keeps the swap flash-free.
 */
export function Mark({ className = '' }: { className?: string }) {
  return (
    <>
      <Image
        src="/brand/qlico-logo.png"
        alt="QLICO"
        width={116}
        height={32}
        priority
        className={`theme-light-only object-contain ${className}`}
      />
      <Image
        src="/brand/qlico-logo-white.png"
        alt="QLICO"
        width={116}
        height={32}
        priority
        className={`theme-dark-only object-contain ${className}`}
      />
    </>
  )
}
