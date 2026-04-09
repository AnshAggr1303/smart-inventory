import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { RECIPE_LABELS } from '@/lib/constants'
import { RecipesLayout } from './RecipesLayout'
import type { Recipe, RecipeListItem } from '@/types/recipes'

export default async function RecipesPage() {
  const supabase = await createServerClient()

  const {
    data: { user },
    error: authError,
  } = await supabase.auth.getUser()
  if (authError || !user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) redirect('/onboarding')

  const org_id = profile.org_id as string

  const { data: org } = await supabase
    .from('organisations')
    .select('industry')
    .eq('id', org_id)
    .single()

  const industry = (org?.industry ?? 'other') as keyof typeof RECIPE_LABELS
  const label = RECIPE_LABELS[industry] ?? 'Recipe'

  // List view — lightweight, only needs count
  const { data: rawRecipes } = await supabase
    .from('recipes')
    .select(`
      id, name, category, yield_qty, yield_unit, is_archived,
      recipe_ingredients(count)
    `)
    .eq('org_id', org_id)
    .eq('is_archived', false)
    .order('name')

  const recipeList: RecipeListItem[] = (rawRecipes ?? []).map(r => ({
    id: r.id,
    name: r.name,
    category: r.category,
    yield_qty: Number(r.yield_qty),
    yield_unit: r.yield_unit ?? '',
    ingredient_count: Array.isArray(r.recipe_ingredients)
      ? ((r.recipe_ingredients[0] as { count: number })?.count ?? 0)
      : 0,
    is_archived: r.is_archived ?? false,
  }))

  // Full recipes with joined ingredient + item data for the detail panel
  const { data: rawFullRecipes } = await supabase
    .from('recipes')
    .select(`
      id, org_id, name, category, yield_qty, yield_unit,
      notes, selling_price, is_archived, created_at, updated_at,
      recipe_ingredients (
        id, org_id, recipe_id, item_id, quantity, unit, unit_multiplier, created_at,
        items (
          name, current_stock, unit, reorder_point, cost_per_unit
        )
      )
    `)
    .eq('org_id', org_id)
    .eq('is_archived', false)
    .order('name')

  type RawFullRecipe = {
    id: string
    org_id: string
    name: string
    category: string | null
    yield_qty: number | null
    yield_unit: string | null
    notes: string | null
    selling_price: number | null
    is_archived: boolean | null
    created_at: string | null
    updated_at: string | null
    recipe_ingredients: Array<{
      id: string
      org_id: string
      recipe_id: string
      item_id: string
      quantity: number
      unit: string
      unit_multiplier: number
      created_at: string | null
      items: {
        name: string
        current_stock: number
        unit: string
        reorder_point: number
        cost_per_unit: number | null
      } | null
    }>
  }

  const fullRecipes: Recipe[] = ((rawFullRecipes ?? []) as unknown as RawFullRecipe[]).map(r => ({
    id: r.id,
    org_id: r.org_id,
    name: r.name,
    category: r.category,
    yield_qty: Number(r.yield_qty),
    yield_unit: r.yield_unit ?? '',
    notes: r.notes,
    selling_price: r.selling_price != null ? Number(r.selling_price) : null,
    is_archived: r.is_archived ?? false,
    created_at: r.created_at ?? new Date().toISOString(),
    updated_at: r.updated_at ?? new Date().toISOString(),
    ingredients: (r.recipe_ingredients ?? []).map(ing => {
      const item = ing.items

      return {
        id: ing.id,
        org_id: ing.org_id,
        recipe_id: ing.recipe_id,
        item_id: ing.item_id,
        quantity: Number(ing.quantity),
        unit: ing.unit,
        unit_multiplier: Number(ing.unit_multiplier),
        created_at: ing.created_at ?? new Date().toISOString(),
        item_name: item?.name ?? 'Unknown',
        current_stock: Number(item?.current_stock ?? 0),
        item_unit: item?.unit ?? '',
        reorder_point: Number(item?.reorder_point ?? 0),
        cost_per_unit: item?.cost_per_unit != null ? Number(item.cost_per_unit) : null,
      }
    }),
  }))

  // Inventory items for the ingredient selector in RecipeForm
  const { data: rawItems } = await supabase
    .from('items')
    .select('id, name, unit')
    .eq('org_id', org_id)
    .eq('is_archived', false)
    .order('name')

  const items = (rawItems ?? []).map(i => ({ id: i.id, name: i.name, unit: i.unit }))

  return (
    <main className="ml-60 flex-1 flex flex-col min-h-screen">
      <header className="sticky top-0 z-30 bg-surface px-8 py-4 flex items-center">
        <h2 className="text-3xl font-bold tracking-tight text-on-surface">{label}s</h2>
      </header>
      <RecipesLayout
        recipes={recipeList}
        allRecipes={fullRecipes}
        items={items}
        label={label}
      />
    </main>
  )
}
