'use client'
// Client component: required by Next.js for error boundaries

import { useEffect } from 'react'
import Link from 'next/link'
import { AlertTriangle } from 'lucide-react'

export default function ItemDetailError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error({ event: 'item_detail_error', digest: error.digest })
  }, [error])

  return (
    <div className="max-w-7xl mx-auto flex flex-col items-center justify-center py-24 gap-4">
      <AlertTriangle className="w-12 h-12 text-outline-variant" />
      <h2 className="text-heading-md font-semibold text-on-surface">Item not found</h2>
      <p className="text-body-md text-on-surface/60">
        We couldn&apos;t load this item. It may have been archived.
      </p>
      <div className="flex gap-3">
        <button
          onClick={reset}
          className="px-5 py-2.5 bg-surface-lowest border border-outline-variant/15 text-on-surface rounded-lg text-body-md font-medium hover:bg-surface transition-colors"
        >
          Retry
        </button>
        <Link
          href="/app/inventory"
          className="px-5 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold hover:-translate-y-px transition-transform"
        >
          Back to Inventory
        </Link>
      </div>
    </div>
  )
}
