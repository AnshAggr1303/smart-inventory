export default function DashboardLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Stats row skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-surface-lowest rounded-card-lg p-6 animate-pulse">
            <div className="h-9 w-9 rounded-lg bg-surface-low mb-4" />
            <div className="h-8 w-16 rounded bg-surface-low mb-2" />
            <div className="h-3 w-24 rounded bg-surface-low" />
          </div>
        ))}
      </div>

      {/* Table skeleton */}
      <div className="bg-surface-lowest rounded-2xl p-6 animate-pulse">
        <div className="h-6 w-32 rounded bg-surface-low mb-6" />
        <div className="space-y-4">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 rounded bg-surface-low" />
          ))}
        </div>
      </div>

      {/* Bottom row skeleton */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-surface-lowest rounded-2xl p-6 animate-pulse space-y-4">
          <div className="h-5 w-40 rounded bg-surface-low" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-12 rounded bg-surface-low" />
          ))}
        </div>
        <div className="bg-surface-lowest rounded-2xl p-6 animate-pulse space-y-4">
          <div className="h-5 w-28 rounded bg-surface-low" />
          {[0, 1, 2].map((i) => (
            <div key={i} className="h-14 rounded bg-surface-low" />
          ))}
        </div>
      </div>
    </div>
  )
}
