'use server'

import { z } from 'zod'
import { redirect } from 'next/navigation'
import { createServerClient } from '@/lib/supabase/server'
import { encryptKey } from '@/lib/crypto/encryptKey'
import { seedIndustryTemplates } from '@/lib/utils/industryTemplates'
import { INDUSTRIES } from '@/lib/constants'
import type { Industry } from '@/types/index'

// ─── Types ────────────────────────────────────────────────────────────────────

export type OnboardingState = { error: string } | null

// ─── Step 2: Create organisation ─────────────────────────────────────────────

const CreateOrgSchema = z.object({
  business_name: z
    .string()
    .min(2, 'Business name must be at least 2 characters')
    .max(80, 'Business name must be under 80 characters'),
  industry: z.enum(INDUSTRIES as unknown as [string, ...string[]], {
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

  // getSession() loads the JWT into the client's internal state so that
  // auth.uid() resolves correctly in PostgREST RLS checks.
  const {
    data: { session },
  } = await supabase.auth.getSession()

  if (!session) {
    return { error: 'Your session has expired. Please log in again.' }
  }

  // Explicitly set the session so PostgREST requests include the JWT.
  // @supabase/ssr does not automatically attach the token to DB requests
  // in Server Actions even when getSession() returns a valid session.
  await supabase.auth.setSession({
    access_token: session.access_token,
    refresh_token: session.refresh_token,
  })

  const user = session.user

  const raw = {
    business_name: formData.get('business_name'),
    industry: formData.get('industry'),
    city: formData.get('city') || undefined,
  }

  const result = CreateOrgSchema.safeParse(raw)
  if (!result.success) {
    return { error: result.error.issues[0]?.message ?? 'Validation failed' }
  }

  const { business_name, industry, city } = result.data

  let actionError: string | null = null
  try {
    const { data: org, error: orgError } = await supabase
      .from('organisations')
      .insert({ name: business_name, industry, city: city ?? null })
      .select('id')
      .single()

    if (orgError || !org) {
      actionError = 'Failed to create your organisation. Please try again.'
    } else {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ org_id: org.id })
        .eq('id', user.id)

      if (profileError) {
        actionError = 'Failed to save your profile. Please try again.'
      } else {
        // Seed industry templates — failure must not block onboarding
        await seedIndustryTemplates(org.id, industry as Industry)
      }
    }
  } catch {
    return { error: 'Something went wrong. Try again.' }
  }

  if (actionError) return { error: actionError }

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
    return { error: result.error.issues[0]?.message ?? 'Validation failed' }
  }

  const { groq_key_1, groq_key_2, groq_key_3, gemini_key } = result.data

  // Encrypt each key individually (synchronous, do NOT await)
  const groqPlaintextKeys = [groq_key_1, groq_key_2, groq_key_3].filter(
    (k): k is string => typeof k === 'string' && k.length > 0
  )
  const encryptedGroqKeys = groqPlaintextKeys.map((k) => encryptKey(k))
  const encryptedGeminiKey =
    gemini_key && gemini_key.length > 0 ? encryptKey(gemini_key) : null

  let actionError: string | null = null
  try {
    // Get org_id from DB (Rule S2 — never from client)
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    const org_id = profile?.org_id ?? null

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
      actionError = 'Failed to save API keys. Please try again.'
    } else {
      const { error: profileError } = await supabase
        .from('user_profiles')
        .update({ onboarding_complete: true })
        .eq('id', user.id)

      if (profileError) {
        actionError = 'Failed to complete setup. Please try again.'
      }
    }
  } catch {
    return { error: 'Something went wrong. Try again.' }
  }

  if (actionError) return { error: actionError }

  redirect('/dashboard')
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

  redirect('/dashboard')
}
