export default function AnalyticsLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Page header skeleton */}
      <div className="space-y-2 animate-pulse">
        <div className="h-7 w-32 rounded bg-surface-low" />
        <div className="h-4 w-64 rounded bg-surface-low" />
      </div>

      {/* KPI cards skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="bg-surface-lowest rounded-card-lg p-6 animate-pulse">
            <div className="h-9 w-9 rounded-lg bg-surface-low mb-4" />
            <div className="h-9 w-28 rounded bg-surface-low mb-2" />
            <div className="h-3 w-24 rounded bg-surface-low" />
          </div>
        ))}
      </div>

      {/* Chart skeleton */}
      <div className="bg-surface-lowest rounded-2xl p-6 animate-pulse">
        <div className="h-5 w-56 rounded bg-surface-low mb-6" />
        <div className="h-60 rounded-xl bg-surface-low" />
      </div>

      {/* Two-column skeleton */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
        <div className="bg-surface-lowest rounded-2xl p-6 animate-pulse space-y-4">
          <div className="h-5 w-44 rounded bg-surface-low" />
          <div className="h-4 w-24 rounded bg-surface-low" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-10 rounded bg-surface-low" />
          ))}
        </div>
        <div className="bg-surface-lowest rounded-2xl p-6 animate-pulse space-y-4">
          <div className="h-5 w-48 rounded bg-surface-low" />
          <div className="h-4 w-20 rounded bg-surface-low" />
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="h-12 rounded bg-surface-low" />
          ))}
        </div>
      </div>

      {/* Agent summary skeleton */}
      <div className="bg-surface-lowest rounded-2xl p-6 animate-pulse">
        <div className="h-5 w-32 rounded bg-surface-low mb-4" />
        <div className="flex gap-8">
          <div className="h-5 w-24 rounded bg-surface-low" />
          <div className="h-5 w-24 rounded bg-surface-low" />
          <div className="h-5 w-24 rounded bg-surface-low" />
        </div>
      </div>
    </div>
  )
}
