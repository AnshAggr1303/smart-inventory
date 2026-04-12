import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { createServerClient } from '@/lib/supabase/server'
import { routeLLMTask } from '@/lib/llm/router'
import { pendingActionExists } from '@/lib/agents/deduplicateAction'
import { DEMAND_LOOKBACK_DAYS, FORECAST_HORIZON_DAYS } from '@/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

type ForecastItem = {
  item_id: string
  item_name: string
  unit: string
  current_stock: number
  avg_daily_consumption: number
  predicted_7day: number
  days_until_stockout: number
  trend: 'increasing' | 'stable' | 'decreasing'
  spike_detected: boolean
  recommended_order_qty: number
}

export type ForecastResult = {
  actions_created: number
  urgent_count: number
}

// ─── Agent ────────────────────────────────────────────────────────────────────

export async function runDemandForecast(
  org_id: string,
  user_id: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<ForecastResult> {
  const supabase = supabaseClient ?? (await createServerClient())

  // Step 1 — Get all active items for org
  const { data: items, error: itemsErr } = await supabase
    .from('items')
    .select('id, name, unit, current_stock, reorder_point')
    .eq('org_id', org_id)
    .eq('is_archived', false)

  if (itemsErr || !items || items.length === 0) {
    return { actions_created: 0, urgent_count: 0 }
  }

  // Get org industry for LLM context
  const { data: org } = await supabase
    .from('organisations')
    .select('industry')
    .eq('id', org_id)
    .single()
  const orgIndustry = org?.industry ?? 'other'

  const now = new Date()
  const lookback30 = new Date(now.getTime() - DEMAND_LOOKBACK_DAYS * 24 * 60 * 60 * 1000).toISOString()
  const lookback7 = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const lookback14 = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString()
  const todayDow = now.getDay() // 0=Sun, 6=Sat

  const forecasts: ForecastItem[] = []

  // Step 2-3 — Calculate per item
  for (const item of items) {
    const { data: txns30 } = await supabase
      .from('transactions')
      .select('quantity, created_at')
      .eq('org_id', org_id)
      .eq('item_id', item.id)
      .in('type', ['recipe_deduction', 'manual_deduction'])
      .gte('created_at', lookback30)

    if (!txns30 || txns30.length === 0) continue

    const totalConsumed30 = txns30.reduce(
      (sum, t) => sum + Math.abs(t.quantity ?? 0),
      0
    )
    const avgDaily = totalConsumed30 / DEMAND_LOOKBACK_DAYS

    if (avgDaily === 0) continue

    // Transactions in last 7 days
    const txns7 = txns30.filter((t) => t.created_at && t.created_at >= lookback7)
    const totalConsumed7 = txns7.reduce(
      (sum, t) => sum + Math.abs(t.quantity ?? 0),
      0
    )
    const avgLast7 = totalConsumed7 / 7

    // Transactions in prev 7 days (days 8-14 ago)
    const txnsPrev7 = txns30.filter(
      (t) => t.created_at && t.created_at >= lookback14 && t.created_at < lookback7
    )
    const totalConsumedPrev7 = txnsPrev7.reduce(
      (sum, t) => sum + Math.abs(t.quantity ?? 0),
      0
    )
    const avgPrev7 = totalConsumedPrev7 / 7

    const trend: ForecastItem['trend'] =
      avgLast7 > avgPrev7 * 1.1
        ? 'increasing'
        : avgLast7 < avgPrev7 * 0.9
          ? 'decreasing'
          : 'stable'

    const daysUntilStockout =
      avgDaily > 0 ? (item.current_stock ?? 0) / avgDaily : Infinity

    // Spike detection — group by day of week
    const dowTotals: Record<number, number> = {}
    const dowCounts: Record<number, number> = {}
    for (const t of txns30) {
      if (!t.created_at) continue
      const dow = new Date(t.created_at).getDay()
      dowTotals[dow] = (dowTotals[dow] ?? 0) + Math.abs(t.quantity ?? 0)
      dowCounts[dow] = (dowCounts[dow] ?? 0) + 1
    }

    const weeklyAvg = avgDaily * 7
    let spikeDetected = false
    for (let d = 0; d < 4; d++) {
      const checkDow = (todayDow + d) % 7
      const dowAvg = dowCounts[checkDow]
        ? (dowTotals[checkDow] ?? 0) / dowCounts[checkDow]
        : 0
      if (dowAvg > weeklyAvg * 1.5) {
        spikeDetected = true
        break
      }
    }

    const recommendedOrderQty = Math.ceil(avgDaily * FORECAST_HORIZON_DAYS * 1.5)

    forecasts.push({
      item_id: item.id,
      item_name: item.name,
      unit: item.unit,
      current_stock: item.current_stock ?? 0,
      avg_daily_consumption: avgDaily,
      predicted_7day: Math.ceil(avgDaily * 7),
      days_until_stockout: Number.isFinite(daysUntilStockout) ? daysUntilStockout : 999,
      trend,
      spike_detected: spikeDetected,
      recommended_order_qty: recommendedOrderQty,
    })
  }

  // Step 4 — Find urgent items
  const urgentItems = forecasts.filter(
    (f) => f.days_until_stockout < FORECAST_HORIZON_DAYS || f.spike_detected
  )
  const urgentCount = urgentItems.length

  if (urgentCount === 0) {
    return { actions_created: 0, urgent_count: 0 }
  }

  // Deduplication — forecast is org-level, use 'forecast' as item_id
  const isDupe = await pendingActionExists(org_id, 'demand_forecast', 'forecast', supabase)
  if (isDupe) {
    return { actions_created: 0, urgent_count: urgentCount }
  }

  // Step 5 — LLM briefing
  const top5 = urgentItems
    .sort((a, b) => a.days_until_stockout - b.days_until_stockout)
    .slice(0, 5)

  const lowestItem = top5[0]

  const forecastPrompt = `You are an inventory advisor for a ${orgIndustry} business. Based on this consumption forecast, write a brief daily briefing (max 3 sentences) about what to watch out for today and this week.

Forecast data: ${JSON.stringify(top5)}

Write only the briefing text. Plain English, no lists, no formatting.`

  let llmBriefing: string
  try {
    const llmResult = await routeLLMTask({
      task: 'demand_forecast',
      payload: { prompt: forecastPrompt, avg_daily: lowestItem?.avg_daily_consumption ?? 0, lead_time_days: FORECAST_HORIZON_DAYS },
      org_id,
      user_id,
    })
    llmBriefing = llmResult.result
  } catch {
    const lowest = lowestItem
    llmBriefing = `${urgentCount} items need attention. Lowest: ${lowest?.item_name ?? 'unknown'} has ${lowest?.days_until_stockout?.toFixed(1) ?? '?'} days left.`
  }

  // Step 6 — Create agent_action
  const { error: insertErr } = await supabase.from('agent_actions').insert({
    org_id,
    agent_type: 'demand_forecast',
    status: 'pending',
    title: `Forecast: ${urgentCount} items need attention`,
    description: llmBriefing,
    payload: {
      item_id: 'forecast',
      forecast_date: now.toISOString(),
      urgent_items_count: urgentCount,
      forecasts: urgentItems,
    },
  })

  if (insertErr) {
    return { actions_created: 0, urgent_count: urgentCount }
  }

  return { actions_created: 1, urgent_count: urgentCount }
}
