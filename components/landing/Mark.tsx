export function Mark({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg 
        width="26" 
        height="26" 
        viewBox="0 0 512 512" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className="text-[var(--foreground)]"
      >
        <g stroke="currentColor" strokeLinecap="round" strokeLinejoin="round">
          <path d="M 140 170 C 200 120 312 120 372 170" strokeWidth="44" />
          <path d="M 110 256 H 402" strokeWidth="44" />
          <path d="M 170 342 H 420" strokeWidth="44" />
          <circle cx="256" cy="256" r="14" fill="currentColor" stroke="none" />
        </g>
      </svg>
      <span className="font-display text-2xl font-black tracking-tighter text-[var(--foreground)]">
        QLICO
      </span>
    </div>
  )
}
