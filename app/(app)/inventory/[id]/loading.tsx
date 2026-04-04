export default function ItemDetailLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-pulse">
      <div className="flex items-center gap-4">
        <div className="w-10 h-10 rounded-full bg-surface-low" />
        <div className="h-8 w-48 rounded bg-surface-low" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {[0, 1, 2].map((i) => <div key={i} className="h-28 rounded-xl bg-surface-low" />)}
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="h-48 rounded-xl bg-surface-low" />
        <div className="h-48 rounded-xl bg-surface-low" />
      </div>
      <div className="h-64 rounded-xl bg-surface-low" />
      <div className="h-64 rounded-xl bg-surface-low" />
    </div>
  )
}
