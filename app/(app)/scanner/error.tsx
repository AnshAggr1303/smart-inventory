'use client'
// Client component: error boundary requires useEffect

export default function ScannerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <span
        className="material-symbols-outlined text-[48px] text-error"
        style={{ fontVariationSettings: "'FILL' 0" }}
      >
        error
      </span>
      <h3 className="text-xl font-semibold text-on-surface">Scanner unavailable</h3>
      <p className="text-sm text-on-surface/60 max-w-xs">
        {error.message || 'Something went wrong loading the bill scanner.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="px-6 py-2.5 bg-gradient-to-r from-primary to-primary-container text-on-primary text-sm font-semibold rounded-lg hover:-translate-y-0.5 transition-all"
      >
        Try again
      </button>
    </div>
  )
}
