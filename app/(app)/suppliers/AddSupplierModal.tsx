'use client'
// Client component: needs useState for modal open/close and useActionState for action result

import { useEffect, useActionState } from 'react'
import { X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { createSupplierAction } from '@/app/(app)/suppliers/actions'

type AddSupplierModalProps = {
  isOpen: boolean
  onClose: () => void
}

export default function AddSupplierModal({ isOpen, onClose }: AddSupplierModalProps) {
  const [state, formAction, isPending] = useActionState(createSupplierAction, null)

  useEffect(() => {
    if (state?.success) {
      toast.success('Supplier added')
      onClose()
    }
  }, [state, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative bg-surface-lowest rounded-2xl w-full max-w-lg p-6"
        style={{ boxShadow: '0 12px 32px -4px rgba(27, 28, 22, 0.06)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-heading-md font-semibold text-on-surface">Add Supplier</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface transition-colors text-on-surface-variant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {state && !state.success && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-error-container text-on-error-container text-body-sm">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-body-sm text-on-surface-variant mb-1">
              Supplier name *
            </label>
            <input
              name="name"
              required
              className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed"
              placeholder="e.g. Fresh Farms Co."
            />
          </div>

          <div>
            <label className="block text-body-sm text-on-surface-variant mb-1">Phone</label>
            <input
              name="phone"
              type="tel"
              className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed"
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label className="block text-body-sm text-on-surface-variant mb-1">Email</label>
            <input
              name="email"
              type="email"
              className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed"
              placeholder="supplier@example.com"
            />
          </div>

          <div>
            <label className="block text-body-sm text-on-surface-variant mb-1">Address</label>
            <textarea
              name="address"
              rows={2}
              className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-none"
              placeholder="Street, city, state"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-surface-lowest rounded-lg text-body-md font-medium text-on-surface border border-outline-variant/15 hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:-translate-y-px transition-transform"
            >
              <Plus className="w-4 h-4" />
              {isPending ? 'Adding…' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
