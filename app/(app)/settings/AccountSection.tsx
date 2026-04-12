'use client'
// Client component: needs useActionState for profile save and router.push for sign-out redirect

import { useEffect, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { updateProfileAction } from '@/app/(app)/settings/actions'
import { createClient } from '@/lib/supabase/client'

type AccountSectionProps = {
  email: string
  fullName: string | null
}

export default function AccountSection({ email, fullName }: AccountSectionProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(updateProfileAction, null)

  useEffect(() => {
    if (state?.success) toast.success('Account saved')
  }, [state])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div
      className="bg-surface-lowest rounded-2xl p-6"
      style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-5">
        Account
      </p>

      {state && !state.success && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-error-container text-on-error-container text-body-sm">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-body-sm text-on-surface-variant mb-1">Email</label>
          <input
            value={email}
            disabled
            className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface-variant cursor-not-allowed opacity-60"
            readOnly
          />
        </div>

        <div>
          <label className="block text-body-sm text-on-surface-variant mb-1">
            Display name
          </label>
          <input
            name="full_name"
            defaultValue={fullName ?? ''}
            className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed"
            placeholder="Your name"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold disabled:opacity-60 hover:-translate-y-px transition-transform"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="px-5 py-2.5 bg-surface-lowest rounded-lg text-body-md font-medium text-on-surface-variant border border-outline-variant/15 hover:bg-surface transition-colors"
          >
            Sign out
          </button>
        </div>
      </form>
    </div>
  )
}
