import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
import type { RecipeCostResult } from '@/types/recipes'
import { STOCK_DECIMAL_PLACES } from '@/lib/constants'

/**
 * Calculates the total ingredient cost for 1 yield of a recipe.
 * Uses items.cost_per_unit, which is updated every time a bill is confirmed.
 * If an ingredient has null cost_per_unit, its line_cost is null (excluded from total).
 */
export async function calculateRecipeCost(
  recipe_id: string,
  org_id: string
): Promise<RecipeCostResult> {
  const supabase = await createServerClient()

  const { data: ingredients, error } = await supabase
    .from('recipe_ingredients')
    .select(`
      quantity,
      unit,
      unit_multiplier,
      items (
        name,
        cost_per_unit
      )
    `)
    .eq('recipe_id', recipe_id)
    .eq('org_id', org_id)

  if (error) throw new Error(`Failed to fetch recipe cost data: ${error.message}`)

  const breakdown = (ingredients ?? []).map((row) => {
    const item = row.items as { name: string; cost_per_unit: number | null } | null
    const item_name = item?.name ?? 'Unknown'
    const cost_per_unit = item?.cost_per_unit ?? null

    // quantity in recipe unit × multiplier = quantity in item base unit
    const qty_in_base = Number(row.quantity) * Number(row.unit_multiplier)
    const line_cost =
      cost_per_unit !== null
        ? Number((qty_in_base * cost_per_unit).toFixed(STOCK_DECIMAL_PLACES))
        : null

    return {
      item_name,
      quantity: Number(row.quantity),
      unit: row.unit,
      cost_per_unit,
      line_cost,
    }
  })

  const cost_per_yield = breakdown.reduce(
    (sum, row) => (row.line_cost !== null ? sum + row.line_cost : sum),
    0
  )

  return { cost_per_yield, breakdown }
}
