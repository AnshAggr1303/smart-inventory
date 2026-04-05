'use client'
// Client component: needs state for modal + useActionState for form result

import { useEffect, useActionState } from 'react'
import { X } from 'lucide-react'
import toast from 'react-hot-toast'
import { updateItemAction } from '@/app/(app)/inventory/actions'
import type { Database } from '@/types/supabase'

type Item = Database['public']['Tables']['items']['Row']
const UNITS = ['g', 'kg', 'ml', 'l', 'pcs', 'tabs', 'strips', 'boxes', 'sheets'] as const

type EditItemModalProps = {
  item: Item | null
  onClose: () => void
}

export default function EditItemModal({ item, onClose }: EditItemModalProps) {
  const [state, formAction, isPending] = useActionState(updateItemAction, null)

  useEffect(() => {
    if (state?.success) {
      toast.success('Item updated')
      onClose()
    }
  }, [state, onClose])

  if (!item) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm" onClick={onClose} />
      <div
        className="relative bg-surface-lowest rounded-2xl w-full max-w-lg p-6"
        style={{ boxShadow: '0 12px 32px -4px rgba(27, 28, 22, 0.06)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-heading-md font-semibold text-on-surface">Edit Item</h2>
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
          <input type="hidden" name="item_id" value={item.id} />
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className="block text-body-sm text-on-surface-variant mb-1">Item name *</label>
              <input name="name" required defaultValue={item.name} className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed" />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">Category</label>
              <input name="category" defaultValue={item.category ?? ''} className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed" />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">Unit *</label>
              <select name="unit" required defaultValue={item.unit} className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed">
                {UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">Reorder point</label>
              <input name="reorder_point" type="number" min="0" step="any" defaultValue={String(item.reorder_point)} className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary-fixed" />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">Reorder qty</label>
              <input name="reorder_qty" type="number" min="0" step="any" defaultValue={String(item.reorder_qty)} className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary-fixed" />
            </div>
            <div className="col-span-2">
              <label className="block text-body-sm text-on-surface-variant mb-1">Cost per unit (₹)</label>
              <input name="cost_per_unit" type="number" min="0" step="any" defaultValue={item.cost_per_unit != null ? String(item.cost_per_unit) : ''} className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface font-mono focus:outline-none focus:ring-2 focus:ring-primary-fixed" placeholder="Optional" />
            </div>
            <div className="col-span-2 flex items-center gap-3">
              <input name="track_expiry" id="edit_track_expiry" type="checkbox" value="true" defaultChecked={item.track_expiry ?? undefined} className="w-4 h-4 rounded accent-primary" />
              <label htmlFor="edit_track_expiry" className="text-body-md text-on-surface cursor-pointer">Track expiry date</label>
            </div>
          </div>

          <div className="flex gap-3 pt-2">
            <button type="button" onClick={onClose} className="flex-1 py-2.5 bg-surface-lowest rounded-lg text-body-md font-medium text-on-surface border border-outline-variant/15 hover:bg-surface transition-colors">
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold disabled:opacity-60 hover:-translate-y-px transition-transform"
            >
              {isPending ? 'Saving…' : 'Save Changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
