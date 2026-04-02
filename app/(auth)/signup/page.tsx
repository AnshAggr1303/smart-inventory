'use client'
// Client component: needs useActionState for server action errors + Google OAuth button

import { useActionState } from 'react'
import Link from 'next/link'
import { signUpAction, type SignUpState } from '@/app/(auth)/actions'

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState(
    signUpAction as (state: SignUpState, payload: FormData) => Promise<SignUpState>,
    null
  )
  // TODO: enable after Google OAuth credentials added in Supabase dashboard

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-heading-md font-semibold text-on-surface">
          Create your account
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Set up Smart Inventory for your business
        </p>
      </div>

      <form action={formAction} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="full_name"
            className="block text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em] px-1"
          >
            Full name
          </label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            minLength={2}
            autoComplete="name"
            placeholder="Your full name"
            className="w-full h-12 bg-surface-low border-none rounded-lg px-4 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-fixed transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em] px-1"
          >
            Work email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@business.com"
            className="w-full h-12 bg-surface-low border-none rounded-lg px-4 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-fixed transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em] px-1"
          >
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            placeholder="Min 8 chars, at least one number"
            className="w-full h-12 bg-surface-low border-none rounded-lg px-4 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-fixed transition-all"
          />
        </div>

        <div className="space-y-1.5">
          <label
            htmlFor="confirm_password"
            className="block text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em] px-1"
          >
            Confirm password
          </label>
          <input
            id="confirm_password"
            name="confirm_password"
            type="password"
            required
            autoComplete="new-password"
            placeholder="••••••••"
            className="w-full h-12 bg-surface-low border-none rounded-lg px-4 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-fixed transition-all"
          />
        </div>

        {state?.error && (
          <p className="text-body-sm text-red-600 px-1">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-14 gradient-primary text-on-primary font-bold rounded-lg hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(30,12,222,0.2)] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isPending ? 'Creating account\u2026' : 'Create account'}
        </button>
      </form>

      {/* TODO: Google OAuth button — enable after credentials added in Supabase dashboard */}

      <p className="text-center text-body-sm text-on-surface-variant">
        Already have an account?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
