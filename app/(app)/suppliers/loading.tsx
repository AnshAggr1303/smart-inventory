export default function SuppliersLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="space-y-1">
        <div className="h-7 w-28 bg-surface-low rounded-lg animate-pulse" />
        <div className="h-4 w-56 bg-surface-low rounded animate-pulse" />
      </div>
      <div
        className="bg-surface-lowest rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
      >
        <div className="bg-surface-low px-6 py-3 flex gap-8">
          {['w-24', 'w-20', 'w-32', 'w-16'].map((w, i) => (
            <div key={i} className={`h-3 ${w} bg-surface-low rounded animate-pulse`} />
          ))}
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="px-6 py-4 border-t border-outline-variant/10 flex gap-8">
            <div className="h-4 w-32 bg-surface-low rounded animate-pulse" />
            <div className="h-4 w-24 bg-surface-low rounded animate-pulse" />
            <div className="h-4 w-40 bg-surface-low rounded animate-pulse" />
            <div className="h-4 w-20 bg-surface-low rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
