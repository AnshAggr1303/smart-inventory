import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { createServerClient } from '@/lib/supabase/server'
import { routeLLMTask } from '@/lib/llm/router'
import { pendingActionExists } from '@/lib/agents/deduplicateAction'
import { SHRINKAGE_FLAG_THRESHOLD_PCT } from '@/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

type VarianceItem = {
  item_id: string
  item_name: string
  expected_qty: number
  actual_qty: number
  variance_qty: number
  variance_pct: number
  estimated_loss: number
  unit: string
  is_flagged: boolean
  is_critical: boolean
}

export type ShrinkageResult = {
  actions_created: number
  total_loss_inr: number
  flagged_count: number
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function runShrinkageAnalysis(
  org_id: string,
  period_days: number,
  user_id: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<ShrinkageResult> {
  const supabase = supabaseClient ?? (await createServerClient())

  const periodStart = new Date(
    Date.now() - period_days * 24 * 60 * 60 * 1000
  ).toISOString()
  const periodEnd = new Date().toISOString()

  // Step 1 — Get all active items for org
  const { data: items, error: itemsErr } = await supabase
    .from('items')
    .select('id, name, unit, current_stock, cost_per_unit')
    .eq('org_id', org_id)
    .eq('is_archived', false)

  if (itemsErr || !items) {
    return { actions_created: 0, total_loss_inr: 0, flagged_count: 0 }
  }

  // Get org industry for LLM context
  const { data: org } = await supabase
    .from('organisations')
    .select('industry')
    .eq('id', org_id)
    .single()
  const orgIndustry = org?.industry ?? 'other'

  const flaggedItems: VarianceItem[] = []

  // Step 2 — Calculate variance per item
  for (const item of items) {
    const { data: txns } = await supabase
      .from('transactions')
      .select('quantity')
      .eq('org_id', org_id)
      .eq('item_id', item.id)
      .gte('created_at', periodStart)

    if (!txns || txns.length === 0) continue

    const additions = txns
      .filter((t) => (t.quantity ?? 0) > 0)
      .reduce((sum, t) => sum + (t.quantity ?? 0), 0)

    const deductions = txns
      .filter((t) => (t.quantity ?? 0) < 0)
      .reduce((sum, t) => sum + Math.abs(t.quantity ?? 0), 0)

    const totalMovement = additions + deductions
    if (totalMovement === 0) continue

    // Expected stock = current + what went out - what came in
    const expectedQty =
      (item.current_stock ?? 0) + deductions - additions
    const actualQty = item.current_stock ?? 0
    const varianceQty = expectedQty - actualQty
    const variancePct =
      totalMovement > 0 ? (varianceQty / totalMovement) * 100 : 0

    if (variancePct <= 0) continue // No unexplained loss

    const estimatedLoss = varianceQty * (item.cost_per_unit ?? 0)
    const isFlagged = variancePct > SHRINKAGE_FLAG_THRESHOLD_PCT
    const isCritical = variancePct > 15

    if (!isFlagged) continue

    flaggedItems.push({
      item_id: item.id,
      item_name: item.name,
      expected_qty: expectedQty,
      actual_qty: actualQty,
      variance_qty: varianceQty,
      variance_pct: variancePct,
      estimated_loss: estimatedLoss,
      unit: item.unit,
      is_flagged: isFlagged,
      is_critical: isCritical,
    })
  }

  if (flaggedItems.length === 0) {
    return { actions_created: 0, total_loss_inr: 0, flagged_count: 0 }
  }

  const totalLossInr = flaggedItems.reduce((sum, i) => sum + i.estimated_loss, 0)
  const flaggedCount = flaggedItems.length

  // Step 5 — Deduplication: shrinkage is org-level, use 'weekly' as item_id
  const isDupe = await pendingActionExists(org_id, 'shrinkage', 'weekly', supabase)
  if (isDupe) {
    return { actions_created: 0, total_loss_inr: totalLossInr, flagged_count: flaggedCount }
  }

  // Step 4 — LLM analysis
  let llmSummary: string
  const shrinkagePrompt = `You are an inventory analyst. Analyse this weekly shrinkage report for a ${orgIndustry} business and identify likely causes and recommendations.

Flagged items with unexplained losses:
${JSON.stringify(flaggedItems)}

Respond with a JSON object:
{
  "summary": "2-sentence plain English summary",
  "likely_causes": ["cause 1", "cause 2"],
  "recommendations": ["action 1", "action 2"],
  "risk_level": "low" | "medium" | "high"
}`

  type LLMAnalysis = {
    summary: string
    likely_causes: string[]
    recommendations: string[]
    risk_level: string
  }

  let llmAnalysis: LLMAnalysis | null = null

  try {
    const llmResult = await routeLLMTask({
      task: 'shrinkage_analyse',
      payload: { prompt: shrinkagePrompt },
      org_id,
      user_id,
    })

    try {
      llmAnalysis = JSON.parse(llmResult.result) as LLMAnalysis
      llmSummary = llmAnalysis.summary ?? ''
    } catch {
      llmSummary = llmResult.result
    }
  } catch {
    llmSummary = `${flaggedItems.length} items show unexplained losses totalling ₹${totalLossInr.toFixed(2)}`
  }

  // Step 6 — Create agent_action
  const { error: insertErr } = await supabase.from('agent_actions').insert({
    org_id,
    agent_type: 'shrinkage',
    status: 'pending',
    title: `Shrinkage: ₹${totalLossInr.toFixed(0)} unexplained loss`,
    description: llmSummary,
    payload: {
      item_id: 'weekly',
      period_start: periodStart,
      period_end: periodEnd,
      total_loss_inr: totalLossInr,
      flagged_items: flaggedItems,
      period_days,
      likely_causes: llmAnalysis?.likely_causes ?? [],
      recommendations: llmAnalysis?.recommendations ?? [],
      risk_level: llmAnalysis?.risk_level ?? 'medium',
    },
  })

  if (insertErr) {
    return { actions_created: 0, total_loss_inr: totalLossInr, flagged_count: flaggedCount }
  }

  return { actions_created: 1, total_loss_inr: totalLossInr, flagged_count: flaggedCount }
}
