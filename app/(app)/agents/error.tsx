'use client'

import { AlertCircle } from 'lucide-react'

export default function AgentsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-8">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-on-surface">Agents unavailable</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Could not load agent data. Your agents are still running in the background —
            try refreshing to see their latest actions.
          </p>
        </div>
        <button
          onClick={reset}
          className="w-full bg-gradient-to-r from-primary to-primary-container text-white font-bold text-sm py-3 rounded-lg hover:opacity-90 active:scale-95 transition-all"
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
