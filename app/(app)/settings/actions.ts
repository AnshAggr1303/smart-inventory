'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { encryptKey } from '@/lib/crypto/encryptKey'
import { INDUSTRIES } from '@/lib/constants'

// ── Helpers ────────────────────────────────────────────────

async function getSessionAndOrg(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, org_id: null }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  return { user, org_id: profile?.org_id ?? null }
}

// ── 1. Update organisation ─────────────────────────────────

const UpdateOrgSchema = z.object({
  name: z.string().min(1, 'Organisation name is required').max(200),
  industry: z.enum(INDUSTRIES as unknown as [string, ...string[]], {
    error: 'Please select a valid industry',
  }),
})

export async function updateOrgAction(
  _prevState: { success: true } | { success: false; error: string } | null,
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerClient()
  const { user, org_id } = await getSessionAndOrg(supabase)
  if (!user || !org_id) return { success: false, error: 'Not authenticated' }

  const parsed = UpdateOrgSchema.safeParse({
    name: formData.get('name'),
    industry: formData.get('industry'),
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { error } = await supabase
    .from('organisations')
    .update({ name: parsed.data.name, industry: parsed.data.industry })
    .eq('id', org_id)

  if (error) {
    return { success: false, error: 'Failed to save organisation. Please try again.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

// ── 2. Update profile (display name) ──────────────────────

const UpdateProfileSchema = z.object({
  full_name: z.string().max(100).optional(),
})

export async function updateProfileAction(
  _prevState: { success: true } | { success: false; error: string } | null,
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = UpdateProfileSchema.safeParse({
    full_name: formData.get('full_name') || undefined,
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ full_name: parsed.data.full_name ?? null })
    .eq('id', user.id)

  if (error) {
    return { success: false, error: 'Failed to save display name. Please try again.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

// ── 3. Update API keys (partial — blank = keep existing) ──

const KeyFieldSchema = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined))

const UpdateApiKeysSchema = z.object({
  groq_key_1: KeyFieldSchema,
  groq_key_2: KeyFieldSchema,
  groq_key_3: KeyFieldSchema,
  gemini_key: KeyFieldSchema,
})

export async function updateApiKeysAction(
  _prevState: { success: true } | { success: false; error: string } | null,
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerClient()
  const { user, org_id } = await getSessionAndOrg(supabase)
  if (!user || !org_id) return { success: false, error: 'Not authenticated' }

  const parsed = UpdateApiKeysSchema.safeParse({
    groq_key_1: formData.get('groq_key_1'),
    groq_key_2: formData.get('groq_key_2'),
    groq_key_3: formData.get('groq_key_3'),
    gemini_key: formData.get('gemini_key'),
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const newKeys = parsed.data

  // Validate prefix format for any provided keys
  const prefixErrors: string[] = []
  if (newKeys.groq_key_1 && !newKeys.groq_key_1.startsWith('gsk_'))
    prefixErrors.push('Groq Key 1 must start with gsk_')
  if (newKeys.groq_key_2 && !newKeys.groq_key_2.startsWith('gsk_'))
    prefixErrors.push('Groq Key 2 must start with gsk_')
  if (newKeys.groq_key_3 && !newKeys.groq_key_3.startsWith('gsk_'))
    prefixErrors.push('Groq Key 3 must start with gsk_')
  if (newKeys.gemini_key && !newKeys.gemini_key.startsWith('AIza'))
    prefixErrors.push('Gemini key must start with AIza')
  if (prefixErrors.length > 0) {
    return { success: false, error: prefixErrors[0]! }
  }

  // Fetch existing encrypted keys
  const { data: existingSettings } = await supabase
    .from('user_settings')
    .select('groq_keys, gemini_key, groq_key_index')
    .eq('user_id', user.id)
    .single()

  // Merge Groq keys: decode existing array, replace slots that have a new value
  let existingGroqEncArr: (string | null)[] = [null, null, null]
  if (existingSettings?.groq_keys) {
    try {
      existingGroqEncArr = JSON.parse(existingSettings.groq_keys) as (string | null)[]
    } catch {
      // malformed — start fresh
    }
  }

  const newGroqPlain = [newKeys.groq_key_1, newKeys.groq_key_2, newKeys.groq_key_3]
  const mergedGroqEnc = newGroqPlain.map((newKey, i) => {
    if (newKey) return encryptKey(newKey)
    return existingGroqEncArr[i] ?? null
  })

  // Merge Gemini key
  const finalGeminiEnc = newKeys.gemini_key
    ? encryptKey(newKeys.gemini_key)
    : (existingSettings?.gemini_key ?? null)

  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: user.id,
      org_id,
      groq_keys: JSON.stringify(mergedGroqEnc),
      gemini_key: finalGeminiEnc,
      groq_key_index: existingSettings?.groq_key_index ?? 0,
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    return { success: false, error: 'Failed to save API keys. Please try again.' }
  }

  revalidatePath('/settings')
  return { success: true }
}
