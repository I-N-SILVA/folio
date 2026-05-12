export function BookSkeleton() {
  return (
    <div className="w-full max-w-4xl mx-auto animate-pulse">
      {/* Book spread */}
      <div className="flex gap-1 rounded-lg overflow-hidden shadow-2xl">
        <div className="flex-1 bg-gray-200 aspect-[1/1.41]" />
        <div className="flex-1 bg-gray-100 aspect-[1/1.41]" />
      </div>
      {/* Controls */}
      <div className="flex items-center justify-center gap-4 mt-4">
        <div className="w-10 h-10 rounded-full bg-gray-200" />
        <div className="w-20 h-5 rounded bg-gray-200" />
        <div className="w-10 h-10 rounded-full bg-gray-200" />
      </div>
    </div>
  )
}
