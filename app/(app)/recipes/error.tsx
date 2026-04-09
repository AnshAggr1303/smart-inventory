'use client'
// Client component: required by Next.js error boundary

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function RecipesError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[RecipesError]', error.message)
  }, [error])

  return (
    <main className="ml-60 flex-1 flex flex-col items-center justify-center gap-6 min-h-screen">
      <AlertTriangle className="w-12 h-12 text-error/60" />
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold text-on-surface">Could not load recipes</h3>
        <p className="text-sm text-on-surface/60 max-w-sm">
          Something went wrong while loading your recipes. Your data is safe.
        </p>
      </div>
      <button
        onClick={reset}
        className="px-6 py-3 bg-gradient-to-r from-primary to-primary-container text-on-primary rounded-xl font-bold hover:opacity-90 transition-all"
      >
        Try again
      </button>
    </main>
  )
}
