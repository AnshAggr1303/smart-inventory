// types/recipes.ts
// Query-result shapes for the recipe engine — these include joined data from
// related tables and differ from the raw DB-row types in types/index.ts.
// Import these types in recipe feature code (Server Actions, components, lib).

export type RecipeIngredient = {
  id: string
  org_id: string
  recipe_id: string
  item_id: string
  quantity: number
  unit: string
  unit_multiplier: number
  created_at: string
  // joined from items:
  item_name: string
  current_stock: number
  item_unit: string
  reorder_point: number
  cost_per_unit: number | null
}

export type Recipe = {
  id: string
  org_id: string
  name: string
  category: string | null
  yield_qty: number
  yield_unit: string
  notes: string | null
  selling_price: number | null
  is_archived: boolean
  created_at: string
  updated_at: string
  ingredients: RecipeIngredient[]
}

export type RecipeListItem = {
  id: string
  name: string
  category: string | null
  yield_qty: number
  yield_unit: string
  ingredient_count: number
  is_archived: boolean
}

export type SufficiencyIngredient = {
  item_id: string
  item_name: string
  required_qty: number
  available_qty: number
  is_sufficient: boolean
  shortfall: number
  unit: string
  enough_for: number
}

export type SufficiencyResult = {
  can_proceed: boolean
  ingredients: SufficiencyIngredient[]
}

export type RecipeCostBreakdown = {
  item_name: string
  quantity: number
  unit: string
  cost_per_unit: number | null
  line_cost: number | null
}

export type RecipeCostResult = {
  cost_per_yield: number
  breakdown: RecipeCostBreakdown[]
}
