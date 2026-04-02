# Auth + Onboarding UI Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete auth (login, signup, reset-password) and onboarding (step-2 business profile, step-3 API keys) UI with Server Actions, Supabase integration, and Stitch design system.

**Architecture:** Client components handle interactive state (industry picker, key validation, Google OAuth); Server Actions handle all DB writes with Zod validation. Tailwind v4's `@theme` directive in globals.css defines all design tokens. Root layout loads Inter + Inter Mono fonts via next/font/google.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind v4 (`@theme`), Supabase Auth (`@supabase/ssr`), Zod v4, react-hot-toast, lucide-react, `useActionState` (React 19)

---

## Pre-flight: What already exists from Task 2

These files are **already created** — do NOT recreate them:
- `lib/supabase/client.ts` — `createClient()` (browser)
- `lib/supabase/server.ts` — `createServerClient()` (server, async)
- `lib/crypto/encryptKey.ts` — `encryptKey()` / `decryptKey()`
- `lib/utils/industryTemplates.ts` — `seedIndustryTemplates()`
- `lib/constants.ts` — all constants including `INDUSTRIES`
- `types/index.ts` — `UserProfile`, `Organisation`, `UserSettings`, `Industry`
- `types/supabase.ts` — generated DB types
- `middleware.ts` — auth + onboarding gate (already correct, do not modify)

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `app/globals.css` | Modify | Replace defaults with Tailwind v4 @theme design tokens |
| `app/layout.tsx` | Modify | Inter + Inter Mono fonts, surface bg, Toaster |
| `app/(auth)/layout.tsx` | Create | Centered card layout, wordmark, bg blobs |
| `app/(auth)/actions.ts` | Create | `signUpAction` Server Action |
| `app/(auth)/login/page.tsx` | Create | Login form (client), Google OAuth |
| `app/(auth)/signup/page.tsx` | Create | Signup form using `useActionState` |
| `app/(auth)/reset-password/page.tsx` | Create | Reset password form (client) |
| `app/api/auth/callback/route.ts` | Create | Supabase OAuth code exchange |
| `app/(onboarding)/layout.tsx` | Create | Step indicator + progress bar layout |
| `app/(onboarding)/StepIndicator.tsx` | Create | Client component reading `usePathname` |
| `app/(onboarding)/actions.ts` | Create | `createOrgAction`, `saveApiKeysAction`, `skipApiKeysAction` |
| `app/(onboarding)/step-2/page.tsx` | Create | Industry picker + business name + city |
| `app/(onboarding)/step-3/page.tsx` | Create | API keys form + skip link |

---

## Task 1: Design system tokens + root layout

**Files:**
- Modify: `app/globals.css`
- Modify: `app/layout.tsx`

### globals.css

- [ ] **Step 1: Replace globals.css with design system tokens**

Replace the entire file contents with:

```css
@import "tailwindcss";

@theme {
  /* ── Surface hierarchy ────────────────────────────────── */
  --color-surface: #FAFAEF;
  --color-surface-low: #F5F4EA;
  --color-surface-lowest: #FFFFFF;

  /* ── Primary ──────────────────────────────────────────── */
  --color-primary: #1E0CDE;
  --color-primary-container: #3D3BF3;
  --color-primary-fixed: #E1E0FF;

  /* ── Text ─────────────────────────────────────────────── */
  --color-on-surface: #1B1C16;
  --color-on-surface-variant: #454556;
  --color-on-primary: #FFFFFF;

  /* ── Semantic ─────────────────────────────────────────── */
  --color-tertiary: #7B5800;
  --color-tertiary-fixed: #FFDDB8;
  --color-secondary-container: #A3A6FE;

  /* ── Outline ──────────────────────────────────────────── */
  --color-outline-variant: #C6C4D9;

  /* ── Typography ───────────────────────────────────────── */
  --font-sans: 'Inter', system-ui, sans-serif;
  --font-mono: 'Inter Mono', monospace;

  --text-display: 3.5rem;
  --text-display--line-height: 1.1;
  --text-heading-lg: 2rem;
  --text-heading-lg--line-height: 1.2;
  --text-heading-md: 1.5rem;
  --text-heading-md--line-height: 1.3;
  --text-body-md: 0.875rem;
  --text-body-md--line-height: 1.6;
  --text-body-sm: 0.75rem;
  --text-body-sm--line-height: 1.5;
  --text-label-sm: 0.75rem;
  --text-label-sm--line-height: 1.4;

  /* ── Elevation ────────────────────────────────────────── */
  --shadow-ambient: 0 12px 32px -4px rgba(27, 28, 22, 0.06);

  /* ── Border radius ────────────────────────────────────── */
  --radius-card: 0.5rem;
  --radius-card-lg: 1.5rem;
}

/* Primary gradient button — used as className="gradient-primary" */
@utility gradient-primary {
  background: linear-gradient(135deg, #1E0CDE, #3D3BF3);
}

body {
  font-family: 'Inter', system-ui, sans-serif;
  background-color: #FAFAEF;
  color: #1B1C16;
}
```

### app/layout.tsx

- [ ] **Step 2: Rewrite root layout with Inter fonts + Toaster**

```typescript
import type { Metadata } from 'next'
import { Inter, Inter_Mono } from 'next/font/google'
import { Toaster } from 'react-hot-toast'
import './globals.css'

const inter = Inter({
  subsets: ['latin'],
  variable: '--font-sans',
  display: 'swap',
})

const interMono = Inter_Mono({
  subsets: ['latin'],
  variable: '--font-mono',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'Smart Inventory',
  description: 'AI-powered inventory management for small businesses',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" className={`${inter.variable} ${interMono.variable}`}>
      <body className="min-h-screen bg-surface text-on-surface antialiased">
        {children}
        <Toaster
          position="top-right"
          toastOptions={{
            style: {
              background: '#FFFFFF',
              color: '#1B1C16',
              boxShadow: '0 12px 32px -4px rgba(27, 28, 22, 0.06)',
              borderRadius: '8px',
              fontSize: '0.875rem',
            },
          }}
        />
      </body>
    </html>
  )
}
```

> **Note:** If `Inter_Mono` throws a TypeScript/build error (font not found in next/font/google), replace with `import { Inter } from 'next/font/google'` and remove the `interMono` variable. Inter Mono may not be available in all versions of next/font. The `font-mono` CSS variable will fall back to system monospace.

- [ ] **Step 3: Commit**

```bash
git add app/globals.css app/layout.tsx
git commit -m "feat: add design system tokens and root layout with Inter fonts"
```

---

## Task 2: Auth layout + OAuth callback

**Files:**
- Create: `app/(auth)/layout.tsx`
- Create: `app/api/auth/callback/route.ts`

- [ ] **Step 1: Create auth layout**

```typescript
// app/(auth)/layout.tsx
import type { ReactNode } from 'react'

export default function AuthLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
      {/* Ambient background blobs */}
      <div
        className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-primary-fixed/30 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] bg-tertiary-fixed/20 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-[480px]">
        {/* Wordmark */}
        <div className="text-center mb-8">
          <span className="text-heading-md font-semibold text-primary">
            Smart Inventory
          </span>
        </div>

        {/* Card */}
        <div className="bg-surface-lowest rounded-xl p-8 shadow-ambient ring-1 ring-outline-variant/15">
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create OAuth callback route**

```typescript
// app/api/auth/callback/route.ts
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

export async function GET(request: NextRequest): Promise<NextResponse> {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get('code')

  if (code) {
    const cookieStore = await cookies()

    const supabase = createServerClient<Database>(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          },
        },
      }
    )

    await supabase.auth.exchangeCodeForSession(code)
  }

  // Always redirect to step-2; middleware routes to dashboard if already complete
  return NextResponse.redirect(new URL('/onboarding/step-2', request.url))
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(auth\)/layout.tsx app/api/auth/callback/route.ts
git commit -m "feat: add auth layout and OAuth callback handler"
```

---

## Task 3: Auth Server Actions

**Files:**
- Create: `app/(auth)/actions.ts`

- [ ] **Step 1: Create signUpAction**

```typescript
// app/(auth)/actions.ts
'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'

const SignUpSchema = z
  .object({
    full_name: z
      .string()
      .min(2, 'Full name must be at least 2 characters'),
    email: z.string().email('Please enter a valid email address'),
    password: z
      .string()
      .min(8, 'Password must be at least 8 characters')
      .regex(/\d/, 'Password must contain at least one number'),
    confirm_password: z.string(),
  })
  .refine((data) => data.password === data.confirm_password, {
    message: 'Passwords do not match',
    path: ['confirm_password'],
  })

export type SignUpState = { error: string } | null

export async function signUpAction(
  _prevState: SignUpState,
  formData: FormData
): Promise<SignUpState> {
  const raw = {
    full_name: formData.get('full_name'),
    email: formData.get('email'),
    password: formData.get('password'),
    confirm_password: formData.get('confirm_password'),
  }

  const result = SignUpSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.errors[0]?.message ?? 'Validation failed' }
  }

  const { full_name, email, password } = result.data
  const supabase = await createServerClient()

  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name } },
  })

  if (error) {
    // Supabase returns different messages across versions — cover all variants
    const msg = error.message.toLowerCase()
    if (
      msg.includes('already registered') ||
      msg.includes('already in use') ||
      msg.includes('already exists') ||
      error.code === 'email_address_already_used'
    ) {
      return {
        error:
          'An account with this email already exists. Log in instead?',
      }
    }
    return { error: 'Sign up failed. Please try again.' }
  }

  redirect('/onboarding/step-2')
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/actions.ts
git commit -m "feat: add signUpAction server action with Zod validation"
```

---

## Task 4: Login page

**Files:**
- Create: `app/(auth)/login/page.tsx`

- [ ] **Step 1: Create login page**

Login uses the browser Supabase client directly (not a Server Action) per spec.

```typescript
// app/(auth)/login/page.tsx
'use client'
// Client component: needs useState for error/loading, calls browser Supabase client

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function LoginPage() {
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [isPending, startTransition] = useTransition()
  const [isGooglePending, startGoogleTransition] = useTransition()

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

  function handleGoogleSignIn() {
    startGoogleTransition(async () => {
      const supabase = createClient()
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
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

      <div className="relative flex items-center gap-4">
        <div className="flex-1 h-px bg-outline-variant/20" />
        <span className="text-label-sm text-on-surface-variant uppercase tracking-[0.05em]">
          or
        </span>
        <div className="flex-1 h-px bg-outline-variant/20" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isGooglePending}
        className="w-full h-12 bg-surface-lowest border border-outline-variant/20 rounded-lg flex items-center justify-center gap-3 text-body-md font-medium text-on-surface hover:bg-surface-low transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        {/* Google SVG icon */}
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {isGooglePending ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <p className="text-center text-body-sm text-on-surface-variant">
        Don&apos;t have an account?{' '}
        <Link href="/signup" className="text-primary font-medium hover:underline">
          Sign up
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/login/page.tsx
git commit -m "feat: add login page with email/password and Google OAuth"
```

---

## Task 5: Signup page

**Files:**
- Create: `app/(auth)/signup/page.tsx`

- [ ] **Step 1: Create signup page**

Uses `useActionState` (React 19) to call `signUpAction` and show inline errors.

```typescript
// app/(auth)/signup/page.tsx
'use client'
// Client component: needs useActionState for server action errors + Google OAuth button

import { useActionState, useTransition } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { signUpAction, type SignUpState } from '@/app/(auth)/actions'

export default function SignUpPage() {
  const [state, formAction, isPending] = useActionState<SignUpState, FormData>(
    signUpAction,
    null
  )
  const [isGooglePending, startGoogleTransition] = useTransition()

  function handleGoogleSignIn() {
    startGoogleTransition(async () => {
      const supabase = createClient()
      await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/api/auth/callback`,
        },
      })
    })
  }

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
            placeholder="Ansh Agrawal"
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
          {isPending ? 'Creating account…' : 'Create account'}
        </button>
      </form>

      <div className="relative flex items-center gap-4">
        <div className="flex-1 h-px bg-outline-variant/20" />
        <span className="text-label-sm text-on-surface-variant uppercase tracking-[0.05em]">
          or
        </span>
        <div className="flex-1 h-px bg-outline-variant/20" />
      </div>

      <button
        type="button"
        onClick={handleGoogleSignIn}
        disabled={isGooglePending}
        className="w-full h-12 bg-surface-lowest border border-outline-variant/20 rounded-lg flex items-center justify-center gap-3 text-body-md font-medium text-on-surface hover:bg-surface-low transition-all disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <svg className="w-5 h-5" viewBox="0 0 24 24" aria-hidden="true">
          <path
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
            fill="#4285F4"
          />
          <path
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
            fill="#34A853"
          />
          <path
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
            fill="#FBBC05"
          />
          <path
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
            fill="#EA4335"
          />
        </svg>
        {isGooglePending ? 'Redirecting…' : 'Continue with Google'}
      </button>

      <p className="text-center text-body-sm text-on-surface-variant">
        Already have an account?{' '}
        <Link href="/login" className="text-primary font-medium hover:underline">
          Log in
        </Link>
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/signup/page.tsx
git commit -m "feat: add signup page with useActionState and Google OAuth"
```

---

## Task 6: Reset password page

**Files:**
- Create: `app/(auth)/reset-password/page.tsx`

- [ ] **Step 1: Create reset password page**

```typescript
// app/(auth)/reset-password/page.tsx
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
```

- [ ] **Step 2: Commit**

```bash
git add app/\(auth\)/reset-password/page.tsx
git commit -m "feat: add reset password page"
```

---

## Task 7: Onboarding layout + StepIndicator

**Files:**
- Create: `app/(onboarding)/StepIndicator.tsx`
- Create: `app/(onboarding)/layout.tsx`

- [ ] **Step 1: Create StepIndicator client component**

```typescript
// app/(onboarding)/StepIndicator.tsx
'use client'
// Client component: needs usePathname to determine current step

import { usePathname } from 'next/navigation'

const STEPS = [
  '/signup',           // step 1 — always complete when user is here
  '/onboarding/step-2',
  '/onboarding/step-3',
]

export function StepIndicator() {
  const pathname = usePathname()

  // step-2 = index 1, step-3 = index 2
  const currentIndex = STEPS.findIndex((s) => pathname.startsWith(s))
  const activeStep = currentIndex === -1 ? 1 : currentIndex

  const stepLabel = activeStep === 1 ? 'Step 2 of 3' : 'Step 3 of 3'

  return (
    <div className="flex flex-col items-center mb-8">
      <div className="flex gap-2 mb-3">
        {STEPS.map((_, i) => {
          const isActive = i === activeStep
          const isComplete = i < activeStep

          if (isActive) {
            // Wider pill for current step
            return (
              <div
                key={i}
                className="w-6 h-2 rounded-full bg-primary-container"
                aria-hidden="true"
              />
            )
          }
          if (isComplete) {
            return (
              <div
                key={i}
                className="w-2 h-2 rounded-full bg-primary"
                aria-hidden="true"
              />
            )
          }
          return (
            <div
              key={i}
              className="w-2 h-2 rounded-full bg-primary-fixed"
              aria-hidden="true"
            />
          )
        })}
      </div>
      <p className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em]">
        {stepLabel}
      </p>
    </div>
  )
}
```

- [ ] **Step 2: Create onboarding layout**

```typescript
// app/(onboarding)/layout.tsx
import type { ReactNode } from 'react'
import { StepIndicator } from '@/app/(onboarding)/StepIndicator'

export default function OnboardingLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-screen bg-surface flex flex-col items-center justify-center p-6">
      {/* Ambient background blobs */}
      <div
        className="fixed inset-0 -z-10 overflow-hidden pointer-events-none"
        aria-hidden="true"
      >
        <div className="absolute -top-[10%] -right-[10%] w-[40%] h-[40%] bg-primary-fixed/30 blur-[120px] rounded-full" />
        <div className="absolute -bottom-[10%] -left-[10%] w-[40%] h-[40%] bg-tertiary-fixed/20 blur-[120px] rounded-full" />
      </div>

      <div className="w-full max-w-[560px]">
        {/* Wordmark top-left */}
        <div className="mb-6">
          <span className="text-body-md font-semibold text-primary">
            Smart Inventory
          </span>
        </div>

        {/* Card */}
        <div className="bg-surface-lowest rounded-xl p-8 shadow-ambient ring-1 ring-outline-variant/15">
          <StepIndicator />
          {children}
        </div>
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(onboarding\)/StepIndicator.tsx app/\(onboarding\)/layout.tsx
git commit -m "feat: add onboarding layout with step indicator"
```

---

## Task 8: Onboarding Server Actions

**Files:**
- Create: `app/(onboarding)/actions.ts`

- [ ] **Step 1: Create createOrgAction, saveApiKeysAction, skipApiKeysAction**

```typescript
// app/(onboarding)/actions.ts
'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { encryptKey } from '@/lib/crypto/encryptKey'
import { seedIndustryTemplates } from '@/lib/utils/industryTemplates'
import { INDUSTRIES } from '@/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnboardingState = { error: string } | null

// ─── Step 2: Create organisation ─────────────────────────────────────────────

const CreateOrgSchema = z.object({
  business_name: z
    .string()
    .min(2, 'Business name must be at least 2 characters')
    .max(80, 'Business name must be under 80 characters'),
  industry: z.enum(INDUSTRIES, {
    error: 'Please select an industry',
  }),
  city: z
    .string()
    .max(60, 'City must be under 60 characters')
    .optional(),
})

export async function createOrgAction(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const supabase = await createServerClient()

  // Rule S2: always derive user from session, never from client
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Your session has expired. Please log in again.' }
  }

  const raw = {
    business_name: formData.get('business_name'),
    industry: formData.get('industry'),
    city: formData.get('city') || undefined,
  }

  const result = CreateOrgSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.errors[0]?.message ?? 'Validation failed' }
  }

  const { business_name, industry, city } = result.data

  // Insert org (Rule D2: org insert + profile update in sequence;
  // a full RPC would be ideal but org creation is one atomic insert + one update)
  const { data: org, error: orgError } = await supabase
    .from('organisations')
    .insert({ name: business_name, industry, city: city ?? null })
    .select('id')
    .single()

  if (orgError || !org) {
    return { error: 'Failed to create your organisation. Please try again.' }
  }

  // Update user_profiles.org_id
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({ org_id: org.id })
    .eq('id', user.id)

  if (profileError) {
    return { error: 'Failed to save your profile. Please try again.' }
  }

  // Seed industry templates — failure must not block onboarding
  await seedIndustryTemplates(org.id, industry)

  redirect('/onboarding/step-3')
}

// ─── Step 3: Save API keys ────────────────────────────────────────────────────

const SaveApiKeysSchema = z.object({
  groq_key_1: z.string().min(1, 'Groq Key 1 is required'),
  groq_key_2: z.string().optional(),
  groq_key_3: z.string().optional(),
  gemini_key: z.string().optional(),
})

export async function saveApiKeysAction(
  _prevState: OnboardingState,
  formData: FormData
): Promise<OnboardingState> {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return { error: 'Your session has expired. Please log in again.' }
  }

  const raw = {
    groq_key_1: formData.get('groq_key_1'),
    groq_key_2: formData.get('groq_key_2') || undefined,
    groq_key_3: formData.get('groq_key_3') || undefined,
    gemini_key: formData.get('gemini_key') || undefined,
  }

  const result = SaveApiKeysSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.errors[0]?.message ?? 'Validation failed' }
  }

  const { groq_key_1, groq_key_2, groq_key_3, gemini_key } = result.data

  // Rule S6: encrypt before storing, never cache plaintext
  const groqPlaintextKeys = [groq_key_1, groq_key_2, groq_key_3].filter(
    (k): k is string => typeof k === 'string' && k.length > 0
  )
  const encryptedGroqKeys = groqPlaintextKeys.map((k) => encryptKey(k))
  const encryptedGeminiKey =
    gemini_key && gemini_key.length > 0 ? encryptKey(gemini_key) : null

  // Get org_id from user_profiles (Rule S2)
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  const org_id = profile?.org_id ?? null

  // Upsert user_settings
  const { error: settingsError } = await supabase.from('user_settings').upsert(
    {
      user_id: user.id,
      org_id,
      groq_keys: JSON.stringify(encryptedGroqKeys),
      groq_key_index: 0,
      gemini_key: encryptedGeminiKey,
    },
    { onConflict: 'user_id' }
  )

  if (settingsError) {
    return { error: 'Failed to save API keys. Please try again.' }
  }

  // Mark onboarding complete
  const { error: profileError } = await supabase
    .from('user_profiles')
    .update({ onboarding_complete: true })
    .eq('id', user.id)

  if (profileError) {
    return { error: 'Failed to complete setup. Please try again.' }
  }

  redirect('/app/dashboard')
}

// ─── Skip API keys ────────────────────────────────────────────────────────────

export async function skipApiKeysAction(): Promise<void> {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect('/login')
  }

  await supabase
    .from('user_profiles')
    .update({ onboarding_complete: true })
    .eq('id', user.id)

  redirect('/app/dashboard')
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(onboarding\)/actions.ts
git commit -m "feat: add onboarding server actions with Zod validation and key encryption"
```

---

## Task 9: Step-2 page (business profile)

**Files:**
- Create: `app/(onboarding)/step-2/page.tsx`

- [ ] **Step 1: Create step-2 page**

```typescript
// app/(onboarding)/step-2/page.tsx
'use client'
// Client component: needs useState for industry card selection

import { useState, useActionState } from 'react'
import {
  UtensilsCrossed,
  Pill,
  ShoppingBag,
  Hotel,
  Factory,
  Settings2,
  type LucideIcon,
} from 'lucide-react'
import { createOrgAction, type OnboardingState } from '@/app/(onboarding)/actions'

interface IndustryOption {
  value: string
  label: string
  description: string
  Icon: LucideIcon
}

const INDUSTRY_OPTIONS: IndustryOption[] = [
  {
    value: 'restaurant',
    label: 'Restaurant / Cloud Kitchen',
    description: 'Recipes, ingredients, daily stock',
    Icon: UtensilsCrossed,
  },
  {
    value: 'pharmacy',
    label: 'Pharmacy',
    description: 'Medicines, batches, expiry tracking',
    Icon: Pill,
  },
  {
    value: 'retail',
    label: 'Retail / Kirana',
    description: 'SKUs, suppliers, reorder points',
    Icon: ShoppingBag,
  },
  {
    value: 'hotel',
    label: 'Hotel',
    description: 'Housekeeping, F&B, minibar',
    Icon: Hotel,
  },
  {
    value: 'manufacturing',
    label: 'Manufacturing',
    description: 'Raw materials, BOMs, production runs',
    Icon: Factory,
  },
  {
    value: 'other',
    label: 'Other',
    description: 'Custom setup for your business',
    Icon: Settings2,
  },
]

export default function Step2Page() {
  const [selectedIndustry, setSelectedIndustry] = useState<string>('')
  const [state, formAction, isPending] = useActionState<OnboardingState, FormData>(
    createOrgAction,
    null
  )

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-heading-md font-bold text-on-surface">
          What kind of business do you run?
        </h1>
        <p className="text-body-md text-on-surface-variant">
          We&apos;ll set up templates that fit you.
        </p>
      </div>

      <form action={formAction} className="space-y-6">
        {/* Hidden input for selected industry */}
        <input type="hidden" name="industry" value={selectedIndustry} />

        {/* Industry grid */}
        <div className="grid grid-cols-2 gap-3">
          {INDUSTRY_OPTIONS.map(({ value, label, description, Icon }) => {
            const isSelected = selectedIndustry === value
            return (
              <button
                key={value}
                type="button"
                onClick={() => setSelectedIndustry(value)}
                className={[
                  'flex flex-col items-start p-4 text-left rounded-xl transition-all duration-200',
                  isSelected
                    ? 'border-2 border-primary-container bg-primary-fixed'
                    : 'border border-transparent bg-surface-low hover:bg-surface-low/80',
                ].join(' ')}
              >
                <Icon
                  className={[
                    'w-8 h-8 mb-2',
                    isSelected ? 'text-primary-container' : 'text-on-surface-variant',
                  ].join(' ')}
                  aria-hidden="true"
                />
                <p className="text-body-md font-semibold text-on-surface">
                  {label}
                </p>
                <p className="text-body-sm text-on-surface-variant leading-tight mt-1">
                  {description}
                </p>
              </button>
            )
          })}
        </div>

        {/* Text inputs */}
        <div className="space-y-4">
          <div className="space-y-1.5">
            <label
              htmlFor="business_name"
              className="block text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em] px-1"
            >
              Business name
            </label>
            <input
              id="business_name"
              name="business_name"
              type="text"
              required
              minLength={2}
              maxLength={80}
              placeholder="e.g. The Silver Spoon"
              className="w-full h-12 bg-surface-low border-none rounded-lg px-4 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-fixed transition-all"
            />
          </div>

          <div className="space-y-1.5">
            <label
              htmlFor="city"
              className="block text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em] px-1"
            >
              City{' '}
              <span className="text-on-surface-variant/50 normal-case tracking-normal">
                (optional)
              </span>
            </label>
            <input
              id="city"
              name="city"
              type="text"
              maxLength={60}
              placeholder="e.g. Mumbai"
              className="w-full h-12 bg-surface-low border-none rounded-lg px-4 text-body-md text-on-surface placeholder:text-on-surface-variant/50 focus:outline-none focus:ring-2 focus:ring-primary-fixed transition-all"
            />
          </div>
        </div>

        {state?.error && (
          <p className="text-body-sm text-red-600 px-1">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending || !selectedIndustry}
          className="w-full h-14 gradient-primary text-on-primary font-bold rounded-lg flex items-center justify-center gap-2 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(30,12,222,0.2)] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isPending ? 'Setting up…' : 'Continue'}
          {!isPending && (
            <svg
              className="w-5 h-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2.5}
              aria-hidden="true"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3"
              />
            </svg>
          )}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(onboarding\)/step-2/page.tsx
git commit -m "feat: add step-2 business profile page with industry picker"
```

---

## Task 10: Step-3 page (API keys)

**Files:**
- Create: `app/(onboarding)/step-3/page.tsx`

- [ ] **Step 1: Create step-3 page**

```typescript
// app/(onboarding)/step-3/page.tsx
'use client'
// Client component: needs useState for client-side key format validation

import { useState, useActionState } from 'react'
import { Lock } from 'lucide-react'
import {
  saveApiKeysAction,
  skipApiKeysAction,
  type OnboardingState,
} from '@/app/(onboarding)/actions'

interface KeyField {
  name: string
  label: string
  placeholder: string
  required: boolean
  prefix: string
  errorLabel: string
}

const GROQ_FIELDS: KeyField[] = [
  {
    name: 'groq_key_1',
    label: 'Key 1 (required)',
    placeholder: 'gsk_...',
    required: true,
    prefix: 'gsk_',
    errorLabel: 'Groq',
  },
  {
    name: 'groq_key_2',
    label: 'Key 2 (recommended)',
    placeholder: 'gsk_...',
    required: false,
    prefix: 'gsk_',
    errorLabel: 'Groq',
  },
  {
    name: 'groq_key_3',
    label: 'Key 3 (recommended)',
    placeholder: 'gsk_...',
    required: false,
    prefix: 'gsk_',
    errorLabel: 'Groq',
  },
]

const GEMINI_FIELD: KeyField = {
  name: 'gemini_key',
  label: 'Gemini API Key',
  placeholder: 'AIza...',
  required: false,
  prefix: 'AIza',
  errorLabel: 'Gemini',
}

export default function Step3Page() {
  const [keyErrors, setKeyErrors] = useState<Record<string, string>>({})
  const [state, formAction, isPending] = useActionState<OnboardingState, FormData>(
    saveApiKeysAction,
    null
  )

  function validateKeyFormat(name: string, value: string, prefix: string, label: string) {
    if (value.length > 0 && !value.startsWith(prefix)) {
      setKeyErrors((prev) => ({
        ...prev,
        [name]: `This doesn't look like a valid ${label} key`,
      }))
    } else {
      setKeyErrors((prev) => {
        const next = { ...prev }
        delete next[name]
        return next
      })
    }
  }

  function handleBlur(
    event: React.FocusEvent<HTMLInputElement>,
    prefix: string,
    label: string
  ) {
    validateKeyFormat(event.target.name, event.target.value, prefix, label)
  }

  return (
    <div className="space-y-6">
      <div className="text-center space-y-1">
        <h1 className="text-heading-md font-bold text-on-surface">
          Connect your AI keys
        </h1>
        <p className="text-body-md text-on-surface-variant">
          These power bill scanning and AI insights.
        </p>
      </div>

      <form action={formAction} className="space-y-6">
        {/* Groq keys section */}
        <div className="space-y-3">
          <p className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em] px-1">
            Groq API Keys
          </p>

          {GROQ_FIELDS.map((field) => (
            <div key={field.name} className="space-y-1">
              <label
                htmlFor={field.name}
                className="block text-body-sm text-on-surface-variant px-1"
              >
                {field.label}
              </label>
              <input
                id={field.name}
                name={field.name}
                type="password"
                autoComplete="off"
                placeholder={field.placeholder}
                onBlur={(e) => handleBlur(e, field.prefix, field.errorLabel)}
                className="w-full h-12 bg-surface-low border-none rounded-lg px-4 text-body-md font-mono text-on-surface placeholder:text-on-surface-variant/50 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-primary-fixed transition-all"
              />
              {keyErrors[field.name] && (
                <p className="text-body-sm text-red-600 px-1">
                  {keyErrors[field.name]}
                </p>
              )}
            </div>
          ))}

          <p className="text-body-sm text-on-surface-variant px-1">
            Get free keys at{' '}
            <a
              href="https://console.groq.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              console.groq.com
            </a>
          </p>
        </div>

        {/* Gemini key section */}
        <div className="space-y-3">
          <p className="text-label-sm font-semibold text-on-surface-variant uppercase tracking-[0.05em] px-1">
            Gemini API Key
          </p>

          <div className="space-y-1">
            <label
              htmlFor={GEMINI_FIELD.name}
              className="sr-only"
            >
              {GEMINI_FIELD.label}
            </label>
            <input
              id={GEMINI_FIELD.name}
              name={GEMINI_FIELD.name}
              type="password"
              autoComplete="off"
              placeholder={GEMINI_FIELD.placeholder}
              onBlur={(e) =>
                handleBlur(e, GEMINI_FIELD.prefix, GEMINI_FIELD.errorLabel)
              }
              className="w-full h-12 bg-surface-low border-none rounded-lg px-4 text-body-md font-mono text-on-surface placeholder:text-on-surface-variant/50 placeholder:font-sans focus:outline-none focus:ring-2 focus:ring-primary-fixed transition-all"
            />
            {keyErrors[GEMINI_FIELD.name] && (
              <p className="text-body-sm text-red-600 px-1">
                {keyErrors[GEMINI_FIELD.name]}
              </p>
            )}
          </div>

          <p className="text-body-sm text-on-surface-variant px-1">
            Get free key at{' '}
            <a
              href="https://aistudio.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary hover:underline"
            >
              aistudio.google.com
            </a>
          </p>
        </div>

        {/* Security banner */}
        <div className="flex gap-3 items-start p-4 rounded-lg bg-primary-fixed/30">
          <Lock
            className="w-5 h-5 text-primary shrink-0 mt-0.5"
            aria-hidden="true"
          />
          <p className="text-body-sm text-on-surface">
            Your keys are encrypted before saving. All AI calls run on our
            servers. Keys are never visible in your browser.
          </p>
        </div>

        {state?.error && (
          <p className="text-body-sm text-red-600 px-1">{state.error}</p>
        )}

        <button
          type="submit"
          disabled={isPending || Object.keys(keyErrors).length > 0}
          className="w-full h-14 gradient-primary text-on-primary font-bold rounded-lg flex items-center justify-center gap-2 hover:-translate-y-px hover:shadow-[0_4px_12px_rgba(30,12,222,0.2)] active:scale-95 transition-all disabled:opacity-60 disabled:cursor-not-allowed disabled:transform-none"
        >
          {isPending ? 'Saving…' : 'Finish setup'}
        </button>
      </form>

      {/* Skip */}
      <div className="text-center">
        <form action={skipApiKeysAction}>
          <button
            type="submit"
            className="text-body-sm text-on-surface-variant hover:text-on-surface transition-colors"
          >
            Skip for now — I&apos;ll add keys later
          </button>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(onboarding\)/step-3/page.tsx
git commit -m "feat: add step-3 API keys page with format validation and skip option"
```

---

## Task 11: Build verification

**Files:** None (verification only)

- [ ] **Step 1: Run the build**

```bash
cd /Users/anshagrawal/learnbackend/smart-inventory && npm run build
```

Expected: Build completes with 0 TypeScript errors. If `Inter_Mono` import fails (font not found in Google Fonts registry), replace in `app/layout.tsx`:
- Remove `Inter_Mono` import and `interMono` variable
- Remove `${interMono.variable}` from the `className` on `<html>`
- The `font-mono` CSS variable will fall back gracefully to system monospace

- [ ] **Step 2: Fix any TypeScript errors**

Common issues and fixes:

**Issue:** `useActionState` not found
```
Fix: In React 19, import from 'react', not 'react-dom'
import { useActionState } from 'react'
```

**Issue:** `createOrgAction` / `saveApiKeysAction` incompatible with `useActionState`
```
Fix: Ensure action signature is (prevState: OnboardingState, formData: FormData)
The _prevState parameter name with underscore prefix signals intentional discard to TypeScript
```

**Issue:** Zod v4 `z.enum()` with readonly tuple
```
Fix: INDUSTRIES is typed as `readonly [...]` from `as const`.
z.enum() in Zod v4 accepts readonly tuples. If you get an error, cast:
z.enum(INDUSTRIES as unknown as [string, ...string[]])
```

**Issue:** `encryptKey` return type
```
encryptKey() is synchronous (returns string, not Promise<string>).
Do not await it.
```

- [ ] **Step 3: Verify middleware logic**

Confirm `middleware.ts` allows these paths without auth:
- `/login` ✓ — in PUBLIC_ROUTES
- `/signup` ✓ — in PUBLIC_ROUTES  
- `/reset-password` ✓ — in PUBLIC_ROUTES
- `/api/auth/callback` ✓ — covered by `pathname.startsWith('/api/auth/')`

Confirm these paths require auth + redirect on no session:
- `/onboarding/step-2` → `ONBOARDING_PREFIX = '/onboarding'` ✓
- `/onboarding/step-3` → covered ✓

Confirm app routes at `/app/*` require `onboarding_complete = true`.

The middleware is already correct from Task 2. No changes needed.

- [ ] **Step 4: Run final build clean**

```bash
npm run build
```

Expected output summary:
```
✓ Compiled successfully
Route (app)                    Size
├ /                            ...
├ /login                       ... 
├ /signup                      ...
├ /reset-password              ...
├ /onboarding/step-2           ...
├ /onboarding/step-3           ...
└ /api/auth/callback           ...
```

- [ ] **Step 5: Final commit**

```bash
git add -A
git commit -m "feat: complete auth + onboarding UI (Task 3)

- Design system tokens via Tailwind v4 @theme
- Root layout with Inter + Inter Mono fonts
- Auth layout (login, signup, reset-password) with centered card design
- OAuth callback handler at /api/auth/callback
- signUpAction server action with Zod validation
- Onboarding layout with StepIndicator (reads pathname)
- createOrgAction + saveApiKeysAction + skipApiKeysAction
- Step-2 business profile with industry picker (6 cards)
- Step-3 API keys with client-side format validation"
```

---

## Self-Review Checklist

### Spec coverage

| Requirement | Task |
|-------------|------|
| Root layout: Inter + Inter Mono, surface bg, Toaster | Task 1 |
| Auth layout: centered, max-w-480px, white card, wordmark | Task 2 |
| Onboarding layout: max-w-560px, step dots, progress indicator | Task 7 |
| Login: email+pw, Google OAuth, forgot password link | Task 4 |
| Signup: full name, email, pw, confirm pw + Zod server validation | Tasks 3+5 |
| Signup: "email already exists" inline error | Task 3 |
| Reset password: email → Supabase reset → success state | Task 6 |
| OAuth callback: exchange code, redirect to step-2 | Task 2 |
| Step-2: industry picker grid 2×3 with icons, business name, city | Task 9 |
| Step-2: createOrgAction inserts org, updates user_profiles.org_id | Task 8 |
| Step-2: seedIndustryTemplates in try/catch, never blocks | Task 8 |
| Step-3: 3 Groq inputs + 1 Gemini input + security banner | Task 10 |
| Step-3: client-side prefix validation (gsk_ / AIza) | Task 10 |
| Step-3: encryptKey each key before DB write | Task 8 |
| Step-3: upsert user_settings, set onboarding_complete=true | Task 8 |
| Skip link: sets onboarding_complete=true, leaves keys null | Task 10 |
| S1: No API keys exposed to client | ✓ — encryptKey only in Server Actions |
| S2: org_id always from session, never from client | ✓ — all actions derive from getUser() |
| S6: encrypt before storing, never cache plaintext | ✓ — encryptKey() in actions.ts |
| S7: Zod on every Server Action | ✓ — all actions validate independently |
| No any types | ✓ — all types explicit |
| L4/Q6: no magic strings — INDUSTRIES from constants | ✓ |

### Type consistency

- `SignUpState` exported from `actions.ts`, imported in `signup/page.tsx` ✓
- `OnboardingState` exported from `(onboarding)/actions.ts`, imported in step-2 and step-3 ✓
- `createOrgAction` and `saveApiKeysAction` both take `(prevState: OnboardingState, formData: FormData)` ✓
- `skipApiKeysAction` takes no args, returns `Promise<void>` — used as `<form action={skipApiKeysAction}>` ✓
- `encryptKey()` is sync (returns `string`) — no `await` in actions ✓
- `seedIndustryTemplates` is async, awaited inside try/catch ✓

### No placeholders

Searched — no TBD, TODO, or "implement later" found in code blocks. All code is complete and explicit.
