'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

// ── Zod schemas ────────────────────────────────────────────

const CreateItemSchema = z.object({
  name: z.string().min(2).max(200),
  category: z.string().max(100).optional(),
  initial_stock: z.coerce.number().min(0),
  unit: z.enum(['g', 'kg', 'ml', 'l', 'pcs', 'tabs', 'strips', 'boxes', 'sheets']),
  reorder_point: z.coerce.number().min(0),
  reorder_qty: z.coerce.number().min(0),
  cost_per_unit: z.coerce.number().min(0).optional(),
  track_expiry: z.coerce.boolean().default(false),
  preferred_supplier_id: z.string().uuid().optional(),
})

const UpdateItemSchema = z.object({
  item_id: z.string().uuid(),
  name: z.string().min(2).max(200),
  category: z.string().max(100).optional(),
  unit: z.enum(['g', 'kg', 'ml', 'l', 'pcs', 'tabs', 'strips', 'boxes', 'sheets']),
  reorder_point: z.coerce.number().min(0),
  reorder_qty: z.coerce.number().min(0),
  cost_per_unit: z.coerce.number().min(0).optional(),
  track_expiry: z.coerce.boolean().default(false),
  preferred_supplier_id: z.string().uuid().optional(),
})

// ── Helpers ────────────────────────────────────────────────

async function getOrgId(supabase: Awaited<ReturnType<typeof createServerClient>>, userId: string): Promise<string> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', userId)
    .single()
  if (!profile?.org_id) redirect('/onboarding/step-2')
  return profile.org_id
}

// ── Actions ────────────────────────────────────────────────

export async function createItemAction(
  _prevState: { success: true; id: string } | { success: false; error: string } | null,
  formData: FormData
): Promise<{ success: true; id: string } | { success: false; error: string }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const org_id = await getOrgId(supabase, user.id)

  const raw = {
    name: formData.get('name'),
    category: formData.get('category') || undefined,
    initial_stock: formData.get('initial_stock'),
    unit: formData.get('unit'),
    reorder_point: formData.get('reorder_point'),
    reorder_qty: formData.get('reorder_qty'),
    cost_per_unit: formData.get('cost_per_unit') || undefined,
    track_expiry: formData.get('track_expiry') === 'true',
    preferred_supplier_id: formData.get('preferred_supplier_id') || undefined,
  }

  const parsed = CreateItemSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { data, error } = await (supabase as unknown as {
    rpc: (name: string, args: Record<string, unknown>) => Promise<{ data: unknown; error: { message: string } | null }>
  }).rpc('create_item_with_initial_stock', {
    p_org_id: org_id,
    p_name: parsed.data.name,
    p_category: parsed.data.category ?? null,
    p_unit: parsed.data.unit,
    p_initial_stock: parsed.data.initial_stock,
    p_reorder_point: parsed.data.reorder_point,
    p_reorder_qty: parsed.data.reorder_qty,
    p_cost_per_unit: parsed.data.cost_per_unit ?? null,
    p_track_expiry: parsed.data.track_expiry,
    p_preferred_supplier_id: parsed.data.preferred_supplier_id ?? null,
    p_user_id: user.id,
  })

  if (error) {
    console.error(JSON.stringify({ event: 'create_item_error', message: error.message, timestamp: new Date().toISOString() }))
    return { success: false, error: 'Failed to create item. Please try again.' }
  }

  revalidatePath('/app/inventory')
  revalidatePath('/app/dashboard')
  return { success: true, id: data as string }
}

export async function updateItemAction(
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
    item_id: formData.get('item_id'),
    name: formData.get('name'),
    category: formData.get('category') || undefined,
    unit: formData.get('unit'),
    reorder_point: formData.get('reorder_point'),
    reorder_qty: formData.get('reorder_qty'),
    cost_per_unit: formData.get('cost_per_unit') || undefined,
    track_expiry: formData.get('track_expiry') === 'true',
    preferred_supplier_id: formData.get('preferred_supplier_id') || undefined,
  }

  const parsed = UpdateItemSchema.safeParse(raw)
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { error } = await supabase
    .from('items')
    .update({
      name: parsed.data.name,
      category: parsed.data.category ?? null,
      unit: parsed.data.unit,
      reorder_point: parsed.data.reorder_point,
      reorder_qty: parsed.data.reorder_qty,
      cost_per_unit: parsed.data.cost_per_unit ?? null,
      track_expiry: parsed.data.track_expiry,
      preferred_supplier_id: parsed.data.preferred_supplier_id ?? null,
    })
    .eq('id', parsed.data.item_id)
    .eq('org_id', org_id)

  if (error) {
    return { success: false, error: 'Failed to update item. Please try again.' }
  }

  revalidatePath('/app/inventory')
  revalidatePath(`/app/inventory/${parsed.data.item_id}`)
  revalidatePath('/app/dashboard')
  return { success: true }
}

export async function archiveItemAction(
  item_id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const org_id = await getOrgId(supabase, user.id)

  const { error } = await supabase
    .from('items')
    .update({ is_archived: true })
    .eq('id', item_id)
    .eq('org_id', org_id)

  if (error) {
    return { success: false, error: 'Failed to archive item. Please try again.' }
  }

  revalidatePath('/app/inventory')
  revalidatePath('/app/dashboard')
  return { success: true }
}
