'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { checkRecipeSufficiency } from '@/lib/recipes/checkSufficiency'
import { getUnitMultiplier } from '@/lib/units/convertUnit'
import {
  InsufficientStockError,
  RecipeNotFoundError,
  UnitConversionNotFoundError,
} from '@/lib/recipes/errors'
import type { SufficiencyResult } from '@/types/recipes'

// ─── Zod schemas ──────────────────────────────────────────────────────────────

const IngredientSchema = z.object({
  item_id: z.string().uuid(),
  quantity: z.number().positive(),
  unit: z.string().min(1),
})

const RecipeBaseSchema = z.object({
  name: z.string().min(2).max(100),
  category: z.string().optional().default(''),
  yield_qty: z.number().positive().default(1),
  yield_unit: z.string().min(1).default('portion'),
  notes: z.string().optional().default(''),
  selling_price: z.number().positive().nullable().optional(),
  ingredients: z.array(IngredientSchema).min(1),
})

const DeductSchema = z.object({
  recipe_id: z.string().uuid(),
  quantity: z.number().positive().int(),
  note: z.string().optional().default(''),
})

const ArchiveSchema = z.object({
  recipe_id: z.string().uuid(),
})

// ─── Helpers ──────────────────────────────────────────────────────────────────

// The generated Supabase types do not yet include the custom RPCs defined in
// migrations. This typed wrapper avoids `any` while keeping strict mode happy.
function rpcCall(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  fn: string,
  params: Record<string, unknown>
): Promise<{ data: unknown; error: { message: string } | null }> {
  const client = supabase as unknown as {
    rpc: (
      fn: string,
      params: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>
  }
  return client.rpc(fn, params)
}

async function getOrgAndUser() {
  const supabase = await createServerClient()
  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) throw new Error('Not authenticated')

  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (profileError || !profile?.org_id) throw new Error('Profile not found')

  return { supabase, user_id: user.id, org_id: profile.org_id as string }
}

async function resolveIngredients(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  org_id: string,
  ingredients: { item_id: string; quantity: number; unit: string }[]
) {
  // Verify all items belong to this org and fetch their base units
  const { data: items, error } = await supabase
    .from('items')
    .select('id, unit')
    .eq('org_id', org_id)
    .in(
      'id',
      ingredients.map(i => i.item_id)
    )

  if (error) throw new Error('Failed to verify ingredient items')

  const itemMap = new Map(items?.map(i => [i.id, i.unit]) ?? [])

  return Promise.all(
    ingredients.map(async ing => {
      const baseUnit = itemMap.get(ing.item_id)
      if (!baseUnit) throw new Error(`Item ${ing.item_id} not found in your inventory`)
      const unit_multiplier = await getUnitMultiplier(ing.unit, baseUnit)
      return { ...ing, unit_multiplier }
    })
  )
}

// ─── createRecipeAction ───────────────────────────────────────────────────────

export async function createRecipeAction(
  rawInput: unknown
): Promise<{ success: true; recipe_id: string } | { success: false; error: string }> {
  try {
    const parsed = RecipeBaseSchema.parse(rawInput)
    const { supabase, org_id } = await getOrgAndUser()

    const resolvedIngredients = await resolveIngredients(supabase, org_id, parsed.ingredients)

    const { data: recipe_id, error } = await rpcCall(supabase, 'create_recipe_with_ingredients', {
      p_org_id: org_id,
      p_name: parsed.name,
      p_category: parsed.category ?? '',
      p_yield_qty: parsed.yield_qty,
      p_yield_unit: parsed.yield_unit,
      p_notes: parsed.notes ?? '',
      p_selling_price: parsed.selling_price ?? null,
      p_ingredients: resolvedIngredients.map(i => ({
        item_id: i.item_id,
        quantity: i.quantity,
        unit: i.unit,
        unit_multiplier: i.unit_multiplier,
      })),
    })

    if (error) throw new Error(error.message)

    revalidatePath('/recipes')
    return { success: true, recipe_id: recipe_id as string }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.issues[0]?.message ?? 'Invalid input' }
    }
    if (err instanceof UnitConversionNotFoundError) {
      return {
        success: false,
        error: `Unit mismatch: cannot convert "${err.from}" → "${err.to}". Check that recipe units match item units.`,
      }
    }
    const message = err instanceof Error ? err.message : 'Failed to create recipe'
    return { success: false, error: message }
  }
}

// ─── updateRecipeAction ───────────────────────────────────────────────────────

export async function updateRecipeAction(
  recipe_id: string,
  rawInput: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const parsed = RecipeBaseSchema.parse(rawInput)
    const { supabase, org_id } = await getOrgAndUser()

    const resolvedIngredients = await resolveIngredients(supabase, org_id, parsed.ingredients)

    const { error } = await rpcCall(supabase, 'update_recipe_with_ingredients', {
      p_org_id: org_id,
      p_recipe_id: recipe_id,
      p_name: parsed.name,
      p_category: parsed.category ?? '',
      p_yield_qty: parsed.yield_qty,
      p_yield_unit: parsed.yield_unit,
      p_notes: parsed.notes ?? '',
      p_selling_price: parsed.selling_price ?? null,
      p_ingredients: resolvedIngredients.map(i => ({
        item_id: i.item_id,
        quantity: i.quantity,
        unit: i.unit,
        unit_multiplier: i.unit_multiplier,
      })),
    })

    if (error) throw new Error(error.message)

    revalidatePath('/recipes')
    return { success: true }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.issues[0]?.message ?? 'Invalid input' }
    }
    if (err instanceof UnitConversionNotFoundError) {
      return {
        success: false,
        error: `Unit mismatch: cannot convert "${err.from}" → "${err.to}". Check that recipe units match item units.`,
      }
    }
    const message = err instanceof Error ? err.message : 'Failed to update recipe'
    return { success: false, error: message }
  }
}

// ─── archiveRecipeAction ──────────────────────────────────────────────────────

export async function archiveRecipeAction(
  rawInput: unknown
): Promise<{ success: true } | { success: false; error: string }> {
  try {
    const { recipe_id } = ArchiveSchema.parse(rawInput)
    const { supabase, org_id } = await getOrgAndUser()

    const { error } = await supabase
      .from('recipes')
      .update({ is_archived: true, updated_at: new Date().toISOString() })
      .eq('id', recipe_id)
      .eq('org_id', org_id)

    if (error) throw new Error(error.message)

    revalidatePath('/recipes')
    return { success: true }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: 'Invalid recipe ID' }
    }
    const message = err instanceof Error ? err.message : 'Failed to archive recipe'
    return { success: false, error: message }
  }
}

// ─── deductRecipeAction ───────────────────────────────────────────────────────

export async function deductRecipeAction(rawInput: unknown): Promise<
  | { success: true; transactions_created: number; low_stock_alerts: string[] }
  | { success: false; error: string; insufficiency?: SufficiencyResult }
> {
  try {
    const parsed = DeductSchema.parse(rawInput)
    const { supabase, user_id, org_id } = await getOrgAndUser()

    // 1. Server-side sufficiency check — never trust the client's preview
    const sufficiency = await checkRecipeSufficiency(parsed.recipe_id, parsed.quantity, org_id)
    if (!sufficiency.can_proceed) {
      const shortItems = sufficiency.ingredients
        .filter(i => !i.is_sufficient)
        .map(i => i.item_name)
      return {
        success: false,
        error: `Insufficient stock for: ${shortItems.join(', ')}`,
        insufficiency: sufficiency,
      }
    }

    // 2. Get recipe name for the default note
    const { data: recipe } = await supabase
      .from('recipes')
      .select('name')
      .eq('id', parsed.recipe_id)
      .eq('org_id', org_id)
      .single()

    if (!recipe) throw new RecipeNotFoundError(parsed.recipe_id)

    const note = parsed.note || `${parsed.quantity}× ${recipe.name}`

    // 3. Atomic deduction — trigger handles current_stock update
    const { error: rpcError } = await rpcCall(supabase, 'deduct_recipe', {
      p_org_id: org_id,
      p_user_id: user_id,
      p_recipe_id: parsed.recipe_id,
      p_quantity: parsed.quantity,
      p_note: note,
    })

    if (rpcError) throw new Error(rpcError.message)

    // 4. Check for items now below reorder_point and create agent_actions
    const { data: updatedIngredients } = await supabase
      .from('recipe_ingredients')
      .select(`
        item_id,
        items (
          name,
          current_stock,
          reorder_point,
          reorder_qty,
          preferred_supplier_id,
          unit
        )
      `)
      .eq('recipe_id', parsed.recipe_id)
      .eq('org_id', org_id)

    const low_stock_alerts: string[] = []

    for (const row of updatedIngredients ?? []) {
      const item = row.items as {
        name: string
        current_stock: number
        reorder_point: number
        reorder_qty: number
        preferred_supplier_id: string | null
        unit: string
      } | null

      if (!item) continue
      if (
        Number(item.reorder_point) > 0 &&
        Number(item.current_stock) <= Number(item.reorder_point)
      ) {
        // Check if a pending reorder action already exists for this item
        const { count: existingCount } = await supabase
          .from('agent_actions')
          .select('id', { count: 'exact', head: true })
          .eq('org_id', org_id)
          .eq('agent_type', 'reorder')
          .eq('status', 'pending')
          .filter('payload->>item_id', 'eq', row.item_id)

        if ((existingCount ?? 0) === 0) {
          low_stock_alerts.push(item.name)
          await supabase.from('agent_actions').insert({
            org_id,
            agent_type: 'reorder',
            status: 'pending',
            title: `Reorder ${item.name}`,
            description: `${item.name} dropped to ${item.current_stock}${item.unit}, below reorder point of ${item.reorder_point}${item.unit}.`,
            payload: {
              item_id: row.item_id,
              current_stock: item.current_stock,
              reorder_point: item.reorder_point,
              reorder_qty: item.reorder_qty,
              unit: item.unit,
              supplier_id: item.preferred_supplier_id,
            },
          })
        } else {
          // Already have a pending reorder — still surface the alert in the UI response
          low_stock_alerts.push(item.name)
        }
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/recipes')
    revalidatePath('/inventory')

    return {
      success: true,
      transactions_created: sufficiency.ingredients.length,
      low_stock_alerts,
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.issues[0]?.message ?? 'Invalid input' }
    }
    if (err instanceof InsufficientStockError) {
      return { success: false, error: err.message }
    }
    const message = err instanceof Error ? err.message : 'Failed to deduct recipe'
    return { success: false, error: message }
  }
}
