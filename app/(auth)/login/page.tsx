'use client'
// Client component: needs useState for error/loading, calls browser Supabase client

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
// TODO: import removed with Google OAuth — restore when credentials are configured

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  // TODO: enable after Google OAuth credentials added in Supabase dashboard

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setError(null)
    const form = event.currentTarget
    const email = (form.elements.namedItem('email') as HTMLInputElement).value
    const password = (form.elements.namedItem('password') as HTMLInputElement).value

    startTransition(async () => {
      const supabase = createClient()
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError('Invalid email or password. Please try again.')
        return
      }

      // Refresh server state then navigate — middleware routes to correct destination
      router.refresh()
      router.push('/app/dashboard')
    })
  }

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-heading-md font-semibold text-on-surface">
          Welcome back
        </h1>
        <p className="text-body-md text-on-surface-variant">
          Sign in to your account
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

        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-1">
            <label
              htmlFor="password"
              className="block text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em]"
            >
              Password
            </label>
            <Link
              href="/reset-password"
              className="text-body-sm text-primary hover:underline"
            >
              Forgot password?
            </Link>
          </div>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            placeholder="••••••••"
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
          {isPending ? 'Signing in…' : 'Sign in'}
        </button>
      </form>

      {/* TODO: Google OAuth button — enable after credentials added in Supabase dashboard */}

      <p className="text-center text-body-sm text-on-surface-variant">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-primary font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
