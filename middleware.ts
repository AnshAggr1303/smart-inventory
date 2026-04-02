import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/types/supabase'

// Routes that never require authentication
const PUBLIC_ROUTES = ['/', '/login', '/signup', '/reset-password', '/api/auth/callback']

// Routes that require auth but do NOT require onboarding_complete = true
const ONBOARDING_PREFIX = '/onboarding'

// Routes that require auth AND onboarding_complete = true
const APP_PREFIX = '/app'

function isPublicRoute(pathname: string): boolean {
  return PUBLIC_ROUTES.some(
    (route) => pathname === route || pathname.startsWith('/api/auth/')
  )
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Always allow public routes through without any DB calls
  if (isPublicRoute(pathname)) {
    return NextResponse.next()
  }

  // Only gate onboarding and app routes
  const isOnboardingRoute = pathname.startsWith(ONBOARDING_PREFIX)
  const isAppRoute = pathname.startsWith(APP_PREFIX)

  if (!isOnboardingRoute && !isAppRoute) {
    return NextResponse.next()
  }

  // Build a response object we can mutate for cookie refresh
  let response = NextResponse.next({ request })

  // Middleware cannot use lib/supabase/server.ts (which relies on next/headers).
  // We wire cookies directly to the request/response here.
  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: use getUser() not getSession() — getSession() can be spoofed
  const {
    data: { user },
  } = await supabase.auth.getUser()

  // No session → redirect to login (never loop: /login is a public route)
  if (!user) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  // Fetch the user's profile to check onboarding state
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id, onboarding_complete')
    .eq('id', user.id)
    .single()

  const onboardingComplete = profile?.onboarding_complete === true
  const orgId = profile?.org_id ?? null

  // Authenticated user trying to access the main app
  if (isAppRoute) {
    if (!onboardingComplete) {
      // Resume onboarding at the correct step — never restart from step 1
      if (!orgId) {
        return NextResponse.redirect(new URL('/onboarding/step-2', request.url))
      }
      // org exists but keys not set → step 3
      return NextResponse.redirect(new URL('/onboarding/step-3', request.url))
    }
    return response
  }

  // Authenticated user on an onboarding route
  if (isOnboardingRoute) {
    // Already finished onboarding → send to dashboard (no infinite loop)
    if (onboardingComplete) {
      return NextResponse.redirect(new URL('/app/dashboard', request.url))
    }
    return response
  }

  return response
}

export const config = {
  matcher: [
    // Match all paths except Next.js internals and files with extensions
    // (static assets, images, fonts, etc.)
    '/((?!_next/static|_next/image|favicon.ico|.*\\..*).*)',
  ],
}
