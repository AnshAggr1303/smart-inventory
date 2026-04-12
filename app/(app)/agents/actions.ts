'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const AgentSettingsSchema = z.object({
  reorder_enabled: z.boolean(),
  shrinkage_enabled: z.boolean(),
  forecast_enabled: z.boolean(),
  shrinkage_threshold_pct: z.number().int().min(1).max(20),
  forecast_horizon_days: z.union([z.literal(7), z.literal(14)]),
  reorder_lead_time_days: z.number().int().min(1).max(30),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

async function getOrgId(): Promise<{ org_id: string; user_id: string } | null> {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) return null

  return { org_id: profile.org_id, user_id: user.id }
}

// ─── Actions ──────────────────────────────────────────────────────────────────

export async function approveAgentAction(
  action_id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerClient()
  const ctx = await getOrgId()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { org_id, user_id } = ctx

  // Verify action belongs to org and is still pending
  const { data: action, error: fetchErr } = await supabase
    .from('agent_actions')
    .select('id, agent_type, status, payload')
    .eq('id', action_id)
    .eq('org_id', org_id)
    .single()

  if (fetchErr || !action) {
    return { success: false, error: 'Action not found' }
  }
  if (action.status !== 'pending') {
    return { success: false, error: 'Action is no longer pending' }
  }

  // Update to approved
  await supabase
    .from('agent_actions')
    .update({
      status: 'approved',
      reviewed_by: user_id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', action_id)

  // For reorder: create a pre-filled bill draft
  if (action.agent_type === 'reorder') {
    const payload = action.payload as Record<string, unknown>

    const parsedItems = [
      {
        name: String(payload.item_name ?? ''),
        quantity: Number(payload.suggested_qty ?? 0),
        unit: String(payload.unit ?? ''),
        price_per_unit: null as number | null,
        total_price: payload.estimated_cost != null ? Number(payload.estimated_cost) : null,
      },
    ]

    const { error: billErr } = await supabase.from('bills').insert({
      org_id,
      created_by: user_id,
      status: 'pending',
      supplier_id: payload.supplier_id != null ? String(payload.supplier_id) : null,
      supplier_name: payload.supplier_name != null ? String(payload.supplier_name) : null,
      parsed_items: parsedItems as unknown as import('@/types/supabase').Json,
    })

    if (billErr) {
      // Bill draft failed — still mark executed, don't block the approval
      console.error(
        JSON.stringify({
          event: 'reorder_bill_draft_failed',
          action_id,
          error: billErr.message,
          timestamp: new Date().toISOString(),
        })
      )
    }
  }

  // Mark executed
  await supabase
    .from('agent_actions')
    .update({
      status: 'executed',
      executed_at: new Date().toISOString(),
    })
    .eq('id', action_id)

  revalidatePath('/agents')
  revalidatePath('/dashboard')

  return { success: true }
}

export async function rejectAgentAction(
  action_id: string
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerClient()
  const ctx = await getOrgId()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { org_id, user_id } = ctx

  // Verify action belongs to org and is still pending
  const { data: action, error: fetchErr } = await supabase
    .from('agent_actions')
    .select('id, status')
    .eq('id', action_id)
    .eq('org_id', org_id)
    .single()

  if (fetchErr || !action) {
    return { success: false, error: 'Action not found' }
  }
  if (action.status !== 'pending') {
    return { success: false, error: 'Action is no longer pending' }
  }

  const { error: updateErr } = await supabase
    .from('agent_actions')
    .update({
      status: 'rejected',
      reviewed_by: user_id,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', action_id)

  if (updateErr) {
    return { success: false, error: 'Failed to reject action' }
  }

  revalidatePath('/agents')

  return { success: true }
}

export async function updateAgentSettingsAction(settings: {
  reorder_enabled: boolean
  shrinkage_enabled: boolean
  forecast_enabled: boolean
  shrinkage_threshold_pct: number
  forecast_horizon_days: number
  reorder_lead_time_days: number
}): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerClient()
  const ctx = await getOrgId()
  if (!ctx) return { success: false, error: 'Not authenticated' }

  const { org_id } = ctx

  // Validate all fields server-side
  const parsed = AgentSettingsSchema.safeParse(settings)
  if (!parsed.success) {
    return { success: false, error: 'Invalid settings' }
  }

  // agent_config is not in the generated Supabase types (added via migration).
  // Cast through unknown to write the JSONB column safely.
  const untypedClient = supabase as unknown as {
    from(table: string): {
      update(
        data: Record<string, unknown>
      ): { eq(col: string, val: string): Promise<{ error: { message: string } | null }> }
    }
  }
  const { error: updateErr } = await untypedClient
    .from('organisations')
    .update({ agent_config: parsed.data })
    .eq('id', org_id)

  if (updateErr) {
    return { success: false, error: 'Failed to save settings' }
  }

  revalidatePath('/agents')

  return { success: true }
}
