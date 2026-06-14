export default function AnalyticsLoading() {
  return (
    <main className="min-h-screen bg-[#f5f5f7] p-6">
      <div className="max-w-5xl mx-auto space-y-6 animate-pulse">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-gray-200 rounded-full" />
          <div className="h-6 w-48 bg-gray-200 rounded" />
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-gray-100 p-4">
              <div className="h-4 w-24 bg-gray-100 rounded mb-3" />
              <div className="h-8 w-16 bg-gray-200 rounded" />
            </div>
          ))}
        </div>
        <div className="bg-white rounded-xl border border-gray-100 p-5 h-64" />
        <div className="bg-white rounded-xl border border-gray-100 p-5 h-64" />
      </div>
    </main>
  )
}
