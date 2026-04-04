'use client'
// Client component: required by Next.js for error boundaries

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

export default function InventoryError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error({ event: 'inventory_error', digest: error.digest })
  }, [error])

  return (
    <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-24 gap-4">
      <AlertTriangle className="w-12 h-12 text-outline-variant" />
      <h2 className="text-heading-md font-semibold text-on-surface">Inventory unavailable</h2>
      <p className="text-body-md text-on-surface/60">We couldn&apos;t load your inventory. Please try again.</p>
      <button
        onClick={reset}
        className="px-5 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold hover:-translate-y-px transition-transform"
      >
        Retry
      </button>
    </div>
  )
}
