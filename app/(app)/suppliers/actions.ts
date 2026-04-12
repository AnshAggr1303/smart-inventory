'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

// ── Schema ─────────────────────────────────────────────────

const CreateSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(200),
  phone: z.string().max(30).optional(),
  email: z
    .string()
    .email('Enter a valid email address')
    .optional()
    .or(z.literal('')),
  address: z.string().max(500).optional(),
})

// ── Helpers ────────────────────────────────────────────────

async function getOrgId(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string
): Promise<string> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', userId)
    .single()
  if (!profile?.org_id) redirect('/onboarding/step-2')
  return profile.org_id
}

// ── Action ─────────────────────────────────────────────────

export async function createSupplierAction(
  _prevState: { success: true } | { success: false; error: string } | null,
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const org_id = await getOrgId(supabase, user.id)

  const raw = {
    name: formData.get('name'),
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    address: formData.get('address') || undefined,
  }

  const parsed = CreateSupplierSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    }
  }

  const { error } = await supabase.from('suppliers').insert({
    org_id,
    name: parsed.data.name,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email || null,
    address: parsed.data.address ?? null,
  })

  if (error) {
    console.error(
      JSON.stringify({
        event: 'create_supplier_error',
        message: error.message,
        timestamp: new Date().toISOString(),
      })
    )
    return { success: false, error: 'Failed to add supplier. Please try again.' }
  }

  revalidatePath('/suppliers')
  return { success: true }
}
