import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
import type { SufficiencyResult } from '@/types/recipes'
import { STOCK_DECIMAL_PLACES } from '@/lib/constants'

/**
 * Checks whether there is sufficient stock to run a recipe `quantity` times.
 * Does NOT write to the DB — safe to call from API route for live preview.
 *
 * required = ri.quantity × quantity × ri.unit_multiplier (in item base unit)
 * shortfall = max(0, required - available)
 * enough_for = floor(available / (ri.quantity × ri.unit_multiplier))
 */
export async function checkRecipeSufficiency(
  recipe_id: string,
  quantity: number,
  org_id: string
): Promise<SufficiencyResult> {
  const supabase = await createServerClient()

  const { data: ingredients, error } = await supabase
    .from('recipe_ingredients')
    .select(`
      item_id,
      quantity,
      unit,
      unit_multiplier,
      items (
        name,
        current_stock,
        unit,
        reorder_point
      )
    `)
    .eq('recipe_id', recipe_id)
    .eq('org_id', org_id)

  if (error) throw new Error(`Failed to fetch recipe ingredients: ${error.message}`)
  if (!ingredients || ingredients.length === 0) {
    return { can_proceed: false, ingredients: [] }
  }

  let can_proceed = true

  const rows = ingredients.map((row) => {
    const item = row.items as {
      name: string
      current_stock: number
      unit: string
      reorder_point: number
    } | null

    if (!item) {
      can_proceed = false
      return {
        item_id: row.item_id,
        item_name: 'Unknown item',
        required_qty: 0,
        available_qty: 0,
        is_sufficient: false,
        shortfall: 0,
        unit: row.unit,
        enough_for: 0,
      }
    }

    const required_qty = Number(
      (Number(row.quantity) * quantity * Number(row.unit_multiplier)).toFixed(STOCK_DECIMAL_PLACES)
    )
    const available_qty = Number(item.current_stock)
    const is_sufficient = available_qty >= required_qty
    const shortfall = is_sufficient
      ? 0
      : Number((required_qty - available_qty).toFixed(STOCK_DECIMAL_PLACES))

    const per_run = Number(row.quantity) * Number(row.unit_multiplier)
    const enough_for = per_run > 0 ? Math.floor(available_qty / per_run) : 0

    if (!is_sufficient) can_proceed = false

    return {
      item_id: row.item_id,
      item_name: item.name,
      required_qty,
      available_qty,
      is_sufficient,
      shortfall,
      unit: row.unit,
      enough_for,
    }
  })

  return { can_proceed, ingredients: rows }
}
