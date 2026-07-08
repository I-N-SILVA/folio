import Image from 'next/image'

export function Mark({ className = '' }: { className?: string }) {
  return (
    <Image src="/brand/qlico-logo.png" alt="QLICO" width={116} height={32} priority className={`object-contain ${className}`} />
  )
}
