'use client'
// Client component: needs useState for success/error state and loading

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const email = (
      event.currentTarget.elements.namedItem('email') as HTMLInputElement
    ).value

    startTransition(async () => {
      const supabase = createClient()
      const { error: resetError } = await supabase.auth.resetPasswordForEmail(
        email,
        {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        }
      )

      if (resetError) {
        setError('Could not send reset email. Please try again.')
        return
      }

      setSuccess(true)
    })
  }

  if (success) {
    return (
      <div className="space-y-4 text-center py-4">
        <div className="w-12 h-12 rounded-full bg-primary-fixed flex items-center justify-center mx-auto">
          <svg
            className="w-6 h-6 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>
        <h1 className="text-heading-md font-semibold text-on-surface">
          Check your email
        </h1>
        <p className="text-body-md text-on-surface-variant">
          We&apos;ve sent a password reset link to your email address.
        </p>
        <Link
          href="/login"
          className="block text-body-sm text-primary font-medium hover:underline"
        >
          Back to login
        </Link>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-heading-md font-semibold text-on-surface">
          Reset your password
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Enter your email and we&apos;ll send a reset link.
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em] px-1"
          >
            Email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full h-12 bg-surface-low border-none rounded-lg px-4 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-fixed transition-all"
          />
        </div>

        {error && (
          <p className="text-body-sm text-red-600 px-1">{error}</p>
        )}

        <button
          type="submit"
          disabled={isPending}
          className="w-full h-14 gradient-primary text-on-primary font-bold rounded-lg hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(30,12,222,0.2)] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isPending ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-body-sm text-on-surface-variant">
        <Link href="/login" className="text-primary font-medium hover:underline">
          Back to login
        </Link>
      </p>
    </div>
  )
}
