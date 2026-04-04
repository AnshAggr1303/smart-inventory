export default function InventoryLoading() {
  return (
    <div className="max-w-7xl mx-auto animate-pulse">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="h-8 w-32 rounded bg-surface-low" />
          <div className="h-4 w-24 rounded bg-surface-low mt-2" />
        </div>
        <div className="h-10 w-28 rounded-lg bg-surface-low" />
      </div>
      <div className="flex gap-3 mb-6">
        <div className="h-10 w-64 rounded-lg bg-surface-low" />
        <div className="h-10 w-80 rounded-xl bg-surface-low" />
      </div>
      <div className="bg-surface-lowest rounded-2xl p-6 space-y-3">
        <div className="h-10 w-full rounded bg-surface-low" />
        {[0, 1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 w-full rounded bg-surface-low" />
        ))}
      </div>
    </div>
  )
}
