'use client'

import { AlertCircle } from 'lucide-react'

export default function SuppliersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="max-w-7xl mx-auto flex items-center justify-center py-24">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-on-surface">Suppliers unavailable</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Could not load suppliers. Try refreshing.
          </p>
        </div>
        <button
          onClick={reset}
          className="w-full gradient-primary text-on-primary font-bold text-sm py-3 rounded-lg hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
        {error.digest && (
          <p className="font-mono text-[10px] text-on-surface-variant/40">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
