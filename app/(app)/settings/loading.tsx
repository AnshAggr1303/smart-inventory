export default function SettingsLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="h-7 w-20 bg-surface-low rounded-lg animate-pulse" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-surface-lowest rounded-2xl p-6 space-y-4"
          style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
        >
          <div className="h-3 w-24 bg-surface-low rounded animate-pulse" />
          <div className="h-10 w-full bg-surface-low rounded-lg animate-pulse" />
          <div className="h-10 w-full bg-surface-low rounded-lg animate-pulse" />
          <div className="h-10 w-24 bg-surface-low rounded-lg animate-pulse" />
        </div>
      ))}
    </div>
  )
}
