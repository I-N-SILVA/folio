export function Mark({ className = '' }: { className?: string }) {
  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      <svg 
        width="28" 
        height="28" 
        viewBox="0 0 32 32" 
        fill="none" 
        xmlns="http://www.w3.org/2000/svg" 
        className="text-[var(--foreground)]"
      >
        <circle cx="14" cy="14" r="10" stroke="currentColor" strokeWidth="5" />
        <path d="M16 16 L28 28" stroke="currentColor" strokeWidth="6" strokeLinecap="round" />
        <rect x="18" y="18" width="12" height="12" rx="3" fill="currentColor" />
      </svg>
      <span className="font-display text-2xl font-black tracking-tighter text-[var(--foreground)]">
        QLICO
      </span>
    </div>
  )
}
