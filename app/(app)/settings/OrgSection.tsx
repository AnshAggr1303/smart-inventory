'use client'
// Client component: needs useActionState for form submission feedback

import { useActionState } from 'react'
import toast from 'react-hot-toast'
import { useEffect } from 'react'
import { updateOrgAction } from '@/app/(app)/settings/actions'
import { INDUSTRIES } from '@/lib/constants'

const INDUSTRY_LABELS: Record<(typeof INDUSTRIES)[number], string> = {
  restaurant: 'Restaurant',
  pharmacy: 'Pharmacy',
  retail: 'Retail',
  hotel: 'Hotel',
  manufacturing: 'Manufacturing',
  other: 'Other',
}

type OrgSectionProps = {
  name: string
  industry: string
}

export default function OrgSection({ name, industry }: OrgSectionProps) {
  const [state, formAction, isPending] = useActionState(updateOrgAction, null)

  useEffect(() => {
    if (state?.success) toast.success('Organisation saved')
  }, [state])

  return (
    <div
      className="bg-surface-lowest rounded-2xl p-6"
      style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-5">
        Organisation
      </p>

      {state && !state.success && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-error-container text-on-error-container text-body-sm">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-body-sm text-on-surface-variant mb-1">
            Business name
          </label>
          <input
            name="name"
            required
            defaultValue={name}
            className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed"
          />
        </div>

        <div>
          <label className="block text-body-sm text-on-surface-variant mb-1">Industry</label>
          <select
            name="industry"
            defaultValue={industry}
            className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed"
          >
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {INDUSTRY_LABELS[ind]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold disabled:opacity-60 hover:-translate-y-px transition-transform"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
