export default function EditorLoading() {
  return (
    <div className="h-screen grid grid-cols-[240px_1fr_320px] animate-pulse">
      {/* Left sidebar */}
      <div className="border-r border-gray-100 bg-white p-4 space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="h-16 bg-gray-100 rounded-lg" />
        ))}
      </div>
      {/* Canvas */}
      <div className="bg-gray-50 flex items-center justify-center">
        <div className="w-[500px] h-[707px] bg-gray-200 rounded-lg shadow-lg" />
      </div>
      {/* Right panel */}
      <div className="border-l border-gray-100 bg-white p-4 space-y-4">
        <div className="h-6 bg-gray-200 rounded w-1/2" />
        <div className="h-10 bg-gray-100 rounded" />
        <div className="h-10 bg-gray-100 rounded" />
        <div className="h-24 bg-gray-100 rounded" />
      </div>
    </div>
  )
}
