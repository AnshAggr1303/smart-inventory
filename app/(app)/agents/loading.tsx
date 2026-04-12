export default function AgentsLoading() {
  return (
    <div className="min-h-screen bg-surface">
      {/* Header skeleton */}
      <div
        className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl px-8 py-6"
        style={{ borderBottom: '1px solid rgba(198, 196, 217, 0.15)' }}
      >
        <div className="space-y-2">
          <div className="h-8 w-24 bg-surface-container rounded-lg animate-pulse" />
          <div className="h-4 w-64 bg-surface-container rounded animate-pulse" />
        </div>
      </div>

      <div className="p-8 max-w-7xl mx-auto space-y-10">
        {/* Tab bar skeleton */}
        <div className="flex bg-surface-container-low p-1 rounded-xl w-fit gap-1">
          <div className="h-9 w-24 bg-surface-container-lowest rounded-lg animate-pulse" />
          <div className="h-9 w-28 bg-surface-container rounded-lg animate-pulse" />
          <div className="h-9 w-20 bg-surface-container rounded-lg animate-pulse" />
        </div>

        {/* Pending section skeleton */}
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <div className="h-7 w-56 bg-surface-container rounded-lg animate-pulse" />
            <div className="h-5 w-20 bg-surface-container rounded-full animate-pulse" />
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {[0, 1, 2].map((i) => (
              <div
                key={i}
                className="bg-surface-container-lowest rounded-xl shadow-[0_12px_32px_-4px_rgba(27,28,22,0.06)] border-l-4 border-surface-container overflow-hidden"
              >
                <div className="p-5 space-y-5">
                  <div className="flex justify-between items-start">
                    <div className="space-y-2">
                      <div className="h-5 w-40 bg-surface-container rounded animate-pulse" />
                      <div className="h-3 w-24 bg-surface-container rounded animate-pulse" />
                    </div>
                    <div className="h-5 w-16 bg-surface-container rounded animate-pulse" />
                  </div>
                  <div className="h-24 bg-surface-container rounded-lg animate-pulse" />
                  <div className="flex gap-2">
                    <div className="flex-1 h-10 bg-surface-container rounded-lg animate-pulse" />
                    <div className="h-10 w-20 bg-surface-container rounded-lg animate-pulse" />
                  </div>
                  <div className="h-5 w-28 bg-surface-container rounded animate-pulse mx-auto" />
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  )
}
