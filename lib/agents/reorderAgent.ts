import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { createServerClient } from '@/lib/supabase/server'
import { routeLLMTask } from '@/lib/llm/router'
import { pendingActionExists } from '@/lib/agents/deduplicateAction'
import {
  DEMAND_LOOKBACK_DAYS,
  REORDER_LEAD_TIME_DAYS,
} from '@/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export type ReorderAgentInput = {
  org_id: string
  triggered_by: 'event' | 'schedule'
  specific_item_id?: string
  /** user_id of an org member — needed to look up LLM keys */
  user_id: string
  /**
   * Pass a service-role client when calling from cron routes so RLS is
   * bypassed. Omit from event-triggered Server Actions — a session client
   * will be created automatically.
   */
  supabaseClient?: SupabaseClient<Database>
}

export type ReorderAgentResult = {
  actions_created: number
  items_checked: number
  items_skipped: number
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function runReorderAgent(
  input: ReorderAgentInput
): Promise<ReorderAgentResult> {
  const { org_id, triggered_by, specific_item_id, user_id, supabaseClient } = input
  const supabase = supabaseClient ?? (await createServerClient())

  let actions_created = 0
  let items_checked = 0
  let items_skipped = 0

  // Step 1 — Find items needing reorder.
  // Supabase JS doesn't support column-to-column WHERE comparison, so we
  // fetch all items with reorder_point > 0 and filter in memory.
  const { data: allCandidates, error: itemsErr } = await supabase
    .from('items')
    .select(
      'id, name, unit, current_stock, reorder_point, reorder_qty, cost_per_unit, preferred_supplier_id'
    )
    .eq('org_id', org_id)
    .neq('is_archived', true)
    .gt('reorder_point', 0)

  if (itemsErr || !allCandidates) return { actions_created, items_checked, items_skipped }

  // Filter: current_stock <= reorder_point (done in JS since Supabase JS
  // doesn't support column-to-column WHERE comparison)
  let items = allCandidates.filter(
    (i) => (i.current_stock ?? 0) <= (i.reorder_point ?? 0)
  )

  if (specific_item_id) {
    items = items.filter((i) => i.id === specific_item_id)
  }

  // Get org info for the LLM draft message
  const { data: org } = await supabase
    .from('organisations')
    .select('name')
    .eq('id', org_id)
    .single()

  const businessName = org?.name ?? 'our business'

  const lookbackDate = new Date(
    Date.now() - DEMAND_LOOKBACK_DAYS * 24 * 60 * 60 * 1000
  ).toISOString()

  // Step 2 — Process each item
  for (const item of items) {
    items_checked++

    // a. Deduplication check
    const isDupe = await pendingActionExists(org_id, 'reorder', item.id, supabase)
    if (isDupe) {
      items_skipped++
      continue
    }

    // b. Calculate average daily consumption (last 30 days)
    const { data: txns } = await supabase
      .from('transactions')
      .select('quantity, unit_multiplier')
      .eq('org_id', org_id)
      .eq('item_id', item.id)
      .in('type', ['recipe_deduction', 'manual_deduction'])
      .gte('created_at', lookbackDate)

    const totalConsumed = (txns ?? []).reduce((sum, t) => {
      const multiplier = t.unit_multiplier ?? 1
      return sum + Math.abs((t.quantity ?? 0) * multiplier)
    }, 0)

    const avgDaily = totalConsumed / DEMAND_LOOKBACK_DAYS

    // c. Calculate suggested quantity
    const daysRemaining =
      avgDaily > 0 ? (item.current_stock ?? 0) / avgDaily : Infinity

    let suggestedQty: number
    if ((item.reorder_qty ?? 0) > 0) {
      suggestedQty = item.reorder_qty ?? 1
    } else if (avgDaily > 0) {
      suggestedQty = Math.ceil(avgDaily * REORDER_LEAD_TIME_DAYS * 2)
    } else {
      suggestedQty = 1
    }
    if (suggestedQty === 0) suggestedQty = 1

    // d. Get supplier info
    let supplierName: string | null = null
    let supplierId: string | null = null
    let supplierPhone: string | null = null

    if (item.preferred_supplier_id) {
      const { data: supplier } = await supabase
        .from('suppliers')
        .select('id, name, phone')
        .eq('id', item.preferred_supplier_id)
        .single()

      if (supplier) {
        supplierId = supplier.id
        supplierName = supplier.name
        supplierPhone = supplier.phone ?? null
      }
    }

    // If no preferred supplier, look for most recent bill supplier for this item
    if (!supplierId) {
      const { data: recentTxn } = await supabase
        .from('transactions')
        .select('bill_id')
        .eq('org_id', org_id)
        .eq('item_id', item.id)
        .eq('type', 'bill_addition')
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (recentTxn?.bill_id) {
        const { data: bill } = await supabase
          .from('bills')
          .select('supplier_id, supplier_name')
          .eq('id', recentTxn.bill_id)
          .single()

        if (bill) {
          supplierId = bill.supplier_id ?? null
          supplierName = bill.supplier_name ?? null
        }
      }
    }

    // e. Draft message using LLM
    let draftMessage: string
    try {
      const llmResult = await routeLLMTask({
        task: 'agent_reason',
        payload: {
          item_name: item.name,
          suggested_qty: suggestedQty,
          unit: item.unit,
          supplier_name: supplierName,
          business_name: businessName,
        },
        org_id,
        user_id,
      })
      draftMessage = llmResult.result
    } catch {
      const supplier = supplierName ?? 'supplier'
      draftMessage = `Hi ${supplier}, please send ${suggestedQty} ${item.unit} of ${item.name} at the earliest.`
    }

    // f. Estimated cost
    const estimatedCost =
      item.cost_per_unit != null ? suggestedQty * item.cost_per_unit : null

    // g. Create agent_action
    const title = `Reorder ${suggestedQty}${item.unit} ${item.name}`
    const description = `Stock at ${(item.current_stock ?? 0).toFixed(2)} ${item.unit}. ${Number.isFinite(daysRemaining) ? daysRemaining.toFixed(1) : '∞'} days remaining at current usage.`

    const { error: insertErr } = await supabase.from('agent_actions').insert({
      org_id,
      agent_type: 'reorder',
      status: 'pending',
      title,
      description,
      payload: {
        item_id: item.id,
        item_name: item.name,
        current_stock: item.current_stock ?? 0,
        reorder_point: item.reorder_point ?? 0,
        suggested_qty: suggestedQty,
        unit: item.unit,
        supplier_id: supplierId,
        supplier_name: supplierName,
        supplier_phone: supplierPhone,
        estimated_cost: estimatedCost,
        draft_message: draftMessage,
        days_remaining: Number.isFinite(daysRemaining) ? daysRemaining : null,
        avg_daily_consumption: avgDaily,
        triggered_by,
      },
    })

    if (!insertErr) {
      actions_created++
    }
  }

  return { actions_created, items_checked, items_skipped }
}
