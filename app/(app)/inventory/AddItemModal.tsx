'use client'
// Client component: needs useState for modal open/close and useActionState for action result

import { useEffect, useActionState } from 'react'
import { X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { createItemAction } from '@/app/(app)/inventory/actions'

const UNITS = ['g', 'kg', 'ml', 'l', 'pcs', 'tabs', 'strips', 'boxes', 'sheets'] as const

type AddItemModalProps = {
  isOpen: boolean
  onClose: () => void
}

export default function AddItemModal({ isOpen, onClose }: AddItemModalProps) {
  const [state, formAction, isPending] = useActionState(createItemAction, null)

  useEffect(() => {
    if (state?.success) {
      toast.success('Item added successfully')
      onClose()
    }
  }, [state, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div
        className="relative bg-surface-lowest rounded-2xl w-full max-w-lg p-6"
        style={{ boxShadow: '0 12px 32px -4px rgba(27, 28, 22, 0.06)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-heading-md font-semibold text-on-surface">Add Item</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-surface transition-colors text-on-surface-variant">
            <X className="w-5 h-5" />
          </button>
        </div>

        {state && !state.success && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-error-container text-on-error-container text-body-sm">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-body-sm text-on-surface-variant mb-1">Item name *</label>
              <input name="name" required minLength={2} className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed" placeholder="e.g. Paneer" />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">Category</label>
              <input name="category" className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed" placeholder="e.g. Dairy" />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">Unit *</label>
              <select name="unit" required className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">Initial stock</label>
              <input name="initial_stock" type="number" min="0" step="any" defaultValue="0" className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary-fixed" />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">Reorder point</label>
              <input name="reorder_point" type="number" min="0" step="any" defaultValue="0" className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary-fixed" />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">Reorder qty</label>
              <input name="reorder_qty" type="number" min="0" step="any" defaultValue="0" className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary-fixed" />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">Cost per unit (₹)</label>
              <input name="cost_per_unit" type="number" min="0" step="any" className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary-fixed" placeholder="Optional" />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <input name="track_expiry" id="track_expiry" type="checkbox" value="true" className="w-4 h-4 rounded accent-primary" />
              <label htmlFor="track_expiry" className="text-body-md text-on-surface cursor-pointer">Track expiry date</label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-surface-lowest rounded-lg text-body-md font-medium text-on-surface border border-outline-variant/15 hover:bg-surface transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:-translate-y-px transition-transform"
            >
              <Plus className="w-4 h-4" />
              {isPending ? 'Adding…' : 'Add Item'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
