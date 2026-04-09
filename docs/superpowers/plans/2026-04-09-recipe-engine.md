# Recipe Engine Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the complete recipe/formula engine — definition UI, atomic deduction, sufficiency check, cost calculation, and low-stock agent triggers.

**Architecture:** Split-view page where a Server Component fetches data and a Client Component manages state. All writes go through Server Actions that call Supabase RPCs (Rule D2). `checkSufficiency` runs server-side for both the preview API route and the final commit action (never trust the client's check). The deduction RPC inserts transactions atomically; the existing trigger on `transactions` updates `current_stock` (Rule D1).

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind, Supabase (Postgres RPCs + RLS), Zod, lucide-react

---

## Context

- Tasks 1–6 are complete; build is clean.
- `recipes` and `recipe_ingredients` tables exist in migration 001 but `selling_price` column does not yet exist.
- No test runner is configured; `npm run build` is the verification gate after each task.
- No barrel files (`index.ts`) — always import from specific file paths (Rule F4).
- All constants from `/lib/constants.ts` (Rule Q5) — `RECIPE_LABELS`, `STOCK_DECIMAL_PLACES`, `DISPLAY_DECIMAL_PLACES`, `CRITICAL_STOCK_THRESHOLD`, `EXPIRY_WARNING_DAYS` already exist there.

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `supabase/migrations/006_recipe_engine.sql` | Create | Add `selling_price` column + 3 RPCs |
| `types/recipes.ts` | Create | Shared TypeScript types for the recipes module |
| `lib/recipes/errors.ts` | Create | Typed error classes (InsufficientStockError, etc.) |
| `lib/units/convertUnit.ts` | Create | Unit multiplier lookup from `unit_conversions` table |
| `lib/recipes/checkSufficiency.ts` | Create | Pre-deduction stock sufficiency check (server-only) |
| `lib/recipes/calculateCost.ts` | Create | Recipe COGS calculation (server-only) |
| `app/(app)/recipes/actions.ts` | Create | createRecipeAction, updateRecipeAction, archiveRecipeAction, deductRecipeAction |
| `app/api/recipes/sufficiency/route.ts` | Create | POST route — real-time sufficiency check for UI preview |
| `app/(app)/recipes/RecipesLayout.tsx` | Create | `'use client'` wrapper managing selected recipe + view/edit/create mode |
| `app/(app)/recipes/RecipeList.tsx` | Create | Left panel — searchable recipe list |
| `app/(app)/recipes/RecipeForm.tsx` | Create | Create/edit form with dynamic ingredient rows |
| `app/(app)/recipes/RecipeDetail.tsx` | Create | Right panel — detail, ingredients table, deduction UI |
| `app/(app)/recipes/page.tsx` | Create | Server Component — data fetch |
| `app/(app)/recipes/loading.tsx` | Create | Split-view skeleton |
| `app/(app)/recipes/error.tsx` | Create | Friendly error with retry |

---

### Task 1: Database Migration 006

**Files:**
- Create: `supabase/migrations/006_recipe_engine.sql`

- [ ] **Step 1.1: Create the migration file**

Create `supabase/migrations/006_recipe_engine.sql`:

```sql
-- supabase/migrations/006_recipe_engine.sql
-- ─── Recipe Engine ────────────────────────────────────────────────────────────
-- 1. Add selling_price column to recipes
-- 2. create_recipe_with_ingredients — atomic recipe creation (recipes + recipe_ingredients)
-- 3. update_recipe_with_ingredients — atomic update (delete-and-reinsert ingredients)
-- 4. deduct_recipe — atomic stock deduction (inserts transactions; trigger handles current_stock)

-- ─── 1. selling_price column ──────────────────────────────────────────────────

alter table recipes
  add column if not exists selling_price numeric(10,2);

-- ─── 2. create_recipe_with_ingredients ───────────────────────────────────────

create or replace function create_recipe_with_ingredients(
  p_org_id        uuid,
  p_user_id       uuid,
  p_name          text,
  p_category      text,
  p_yield_qty     numeric,
  p_yield_unit    text,
  p_notes         text,
  p_selling_price numeric,
  p_ingredients   jsonb
  -- jsonb array of:
  -- { item_id: uuid, quantity: numeric, unit: text, unit_multiplier: numeric }
)
returns uuid   -- returns new recipe_id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe_id uuid;
  v_ing       record;
begin
  insert into recipes (
    org_id, name, category, yield_qty, yield_unit, notes, selling_price
  ) values (
    p_org_id, p_name, p_category, p_yield_qty, p_yield_unit, p_notes, p_selling_price
  )
  returning id into v_recipe_id;

  for v_ing in
    select *
    from jsonb_to_recordset(p_ingredients) as x(
      item_id         uuid,
      quantity        numeric,
      unit            text,
      unit_multiplier numeric
    )
  loop
    insert into recipe_ingredients (
      org_id, recipe_id, item_id, quantity, unit, unit_multiplier
    ) values (
      p_org_id, v_recipe_id, v_ing.item_id,
      v_ing.quantity, v_ing.unit, v_ing.unit_multiplier
    );
  end loop;

  return v_recipe_id;
end;
$$;

grant execute on function create_recipe_with_ingredients(
  uuid, uuid, text, text, numeric, text, text, numeric, jsonb
) to authenticated;

-- ─── 3. update_recipe_with_ingredients ───────────────────────────────────────

create or replace function update_recipe_with_ingredients(
  p_org_id        uuid,
  p_recipe_id     uuid,
  p_name          text,
  p_category      text,
  p_yield_qty     numeric,
  p_yield_unit    text,
  p_notes         text,
  p_selling_price numeric,
  p_ingredients   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ing record;
begin
  if not exists (
    select 1 from recipes
    where id = p_recipe_id and org_id = p_org_id
  ) then
    raise exception 'Recipe not found or access denied';
  end if;

  update recipes set
    name          = p_name,
    category      = p_category,
    yield_qty     = p_yield_qty,
    yield_unit    = p_yield_unit,
    notes         = p_notes,
    selling_price = p_selling_price,
    updated_at    = now()
  where id = p_recipe_id and org_id = p_org_id;

  -- Delete and re-insert — never diff individual rows
  delete from recipe_ingredients
  where recipe_id = p_recipe_id and org_id = p_org_id;

  for v_ing in
    select *
    from jsonb_to_recordset(p_ingredients) as x(
      item_id         uuid,
      quantity        numeric,
      unit            text,
      unit_multiplier numeric
    )
  loop
    insert into recipe_ingredients (
      org_id, recipe_id, item_id, quantity, unit, unit_multiplier
    ) values (
      p_org_id, p_recipe_id, v_ing.item_id,
      v_ing.quantity, v_ing.unit, v_ing.unit_multiplier
    );
  end loop;
end;
$$;

grant execute on function update_recipe_with_ingredients(
  uuid, uuid, text, text, numeric, text, text, numeric, jsonb
) to authenticated;

-- ─── 4. deduct_recipe ─────────────────────────────────────────────────────────
-- Inserts one transaction per ingredient. The trigger on transactions
-- updates items.current_stock atomically — never touch current_stock directly.

create or replace function deduct_recipe(
  p_org_id    uuid,
  p_user_id   uuid,
  p_recipe_id uuid,
  p_quantity  numeric,
  p_note      text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ingredient record;
begin
  for v_ingredient in
    select
      ri.item_id,
      ri.quantity,
      ri.unit,
      ri.unit_multiplier
    from recipe_ingredients ri
    join items i on i.id = ri.item_id
    where ri.recipe_id = p_recipe_id
      and ri.org_id    = p_org_id
  loop
    insert into transactions (
      org_id,
      item_id,
      type,
      quantity,
      unit,
      unit_multiplier,
      recipe_id,
      performed_by,
      note
    ) values (
      p_org_id,
      v_ingredient.item_id,
      'recipe_deduction',
      -(v_ingredient.quantity * p_quantity),
      v_ingredient.unit,
      v_ingredient.unit_multiplier,
      p_recipe_id,
      p_user_id,
      p_note
    );
  end loop;
end;
$$;

grant execute on function deduct_recipe(
  uuid, uuid, uuid, numeric, text
) to authenticated;
```

- [ ] **Step 1.2: Run migration in Supabase SQL Editor**

Paste the full SQL into Supabase Dashboard → SQL Editor → Run. Then verify:

```sql
-- Verify selling_price column exists
select column_name from information_schema.columns
where table_name = 'recipes' and column_name = 'selling_price';

-- Verify all 3 RPCs exist
select proname from pg_proc
where proname in (
  'create_recipe_with_ingredients',
  'update_recipe_with_ingredients',
  'deduct_recipe'
);
```

Expected: `selling_price` returned once; 3 function names returned.

- [ ] **Step 1.3: Commit**

```bash
git add supabase/migrations/006_recipe_engine.sql
git commit -m "feat: add recipe engine RPCs and selling_price column"
```

---

### Task 2: Types and Error Classes

**Files:**
- Create: `types/recipes.ts`
- Create: `lib/recipes/errors.ts`

- [ ] **Step 2.1: Create shared types**

Create `types/recipes.ts`:

```typescript
// types/recipes.ts

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
```

- [ ] **Step 2.2: Create error classes**

Create `lib/recipes/errors.ts`:

```typescript
// lib/recipes/errors.ts

export class InsufficientStockError extends Error {
  readonly items: { name: string; shortfall: number; unit: string }[]

  constructor(items: { name: string; shortfall: number; unit: string }[]) {
    super(`Insufficient stock for: ${items.map(i => i.name).join(', ')}`)
    this.name = 'InsufficientStockError'
    this.items = items
  }
}

export class RecipeNotFoundError extends Error {
  constructor(recipe_id: string) {
    super(`Recipe not found: ${recipe_id}`)
    this.name = 'RecipeNotFoundError'
  }
}

export class UnitConversionNotFoundError extends Error {
  readonly from: string
  readonly to: string

  constructor(from: string, to: string) {
    super(`No unit conversion found: ${from} → ${to}`)
    this.name = 'UnitConversionNotFoundError'
    this.from = from
    this.to = to
  }
}

export class EmptyRecipeError extends Error {
  constructor() {
    super('Recipe must have at least one ingredient')
    this.name = 'EmptyRecipeError'
  }
}
```

- [ ] **Step 2.3: Verify build**

```bash
npm run build
```

Expected: No new errors.

- [ ] **Step 2.4: Commit**

```bash
git add types/recipes.ts lib/recipes/errors.ts
git commit -m "feat: add recipe types and error classes"
```

---

### Task 3: Unit Conversion Utility

**Files:**
- Create: `lib/units/convertUnit.ts`

- [ ] **Step 3.1: Create convertUnit.ts**

Create `lib/units/convertUnit.ts`:

```typescript
import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
import { UnitConversionNotFoundError } from '@/lib/recipes/errors'
import { STOCK_DECIMAL_PLACES } from '@/lib/constants'

/**
 * Returns the multiplier to convert from_unit → to_unit.
 * Returns 1 if from_unit === to_unit (no conversion needed).
 * Throws UnitConversionNotFoundError if the pair is absent from unit_conversions.
 */
export async function getUnitMultiplier(
  from_unit: string,
  to_unit: string
): Promise<number> {
  if (from_unit === to_unit) return 1

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('unit_conversions')
    .select('multiplier')
    .eq('from_unit', from_unit)
    .eq('to_unit', to_unit)
    .single()

  if (error || data === null) {
    throw new UnitConversionNotFoundError(from_unit, to_unit)
  }

  return Number(data.multiplier)
}

/**
 * Multiplies quantity by multiplier and rounds to STOCK_DECIMAL_PLACES (4)
 * to avoid floating-point drift in stored values.
 */
export function convertQuantity(quantity: number, multiplier: number): number {
  return Number((quantity * multiplier).toFixed(STOCK_DECIMAL_PLACES))
}
```

- [ ] **Step 3.2: Verify build**

```bash
npm run build
```

- [ ] **Step 3.3: Commit**

```bash
git add lib/units/convertUnit.ts
git commit -m "feat: add unit conversion utility"
```

---

### Task 4: checkSufficiency

**Files:**
- Create: `lib/recipes/checkSufficiency.ts`

- [ ] **Step 4.1: Create checkSufficiency.ts**

Create `lib/recipes/checkSufficiency.ts`:

```typescript
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
```

- [ ] **Step 4.2: Verify build**

```bash
npm run build
```

- [ ] **Step 4.3: Commit**

```bash
git add lib/recipes/checkSufficiency.ts
git commit -m "feat: add recipe sufficiency check"
```

---

### Task 5: calculateCost

**Files:**
- Create: `lib/recipes/calculateCost.ts`

- [ ] **Step 5.1: Create calculateCost.ts**

Create `lib/recipes/calculateCost.ts`:

```typescript
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
```

- [ ] **Step 5.2: Verify build**

```bash
npm run build
```

- [ ] **Step 5.3: Commit**

```bash
git add lib/recipes/calculateCost.ts
git commit -m "feat: add recipe cost calculation"
```

---

### Task 6: Server Actions

**Files:**
- Create: `app/(app)/recipes/actions.ts`

- [ ] **Step 6.1: Create actions.ts**

Create `app/(app)/recipes/actions.ts`:

```typescript
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
    const { supabase, user_id, org_id } = await getOrgAndUser()

    const resolvedIngredients = await resolveIngredients(supabase, org_id, parsed.ingredients)

    const { data: recipe_id, error } = await supabase.rpc(
      'create_recipe_with_ingredients',
      {
        p_org_id: org_id,
        p_user_id: user_id,
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
      }
    )

    if (error) throw new Error(error.message)

    revalidatePath('/recipes')
    return { success: true, recipe_id: recipe_id as string }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors[0]?.message ?? 'Invalid input' }
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

    const { error } = await supabase.rpc('update_recipe_with_ingredients', {
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
      return { success: false, error: err.errors[0]?.message ?? 'Invalid input' }
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
    const { error: rpcError } = await supabase.rpc('deduct_recipe', {
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
      }
    }

    revalidatePath('/dashboard')
    revalidatePath('/recipes')

    return {
      success: true,
      transactions_created: sufficiency.ingredients.length,
      low_stock_alerts,
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return { success: false, error: err.errors[0]?.message ?? 'Invalid input' }
    }
    if (err instanceof InsufficientStockError) {
      return { success: false, error: err.message }
    }
    const message = err instanceof Error ? err.message : 'Failed to deduct recipe'
    return { success: false, error: message }
  }
}
```

- [ ] **Step 6.2: Verify build**

```bash
npm run build
```

Fix any TypeScript errors before continuing.

- [ ] **Step 6.3: Commit**

```bash
git add "app/(app)/recipes/actions.ts"
git commit -m "feat: add recipe server actions (create, update, archive, deduct)"
```

---

### Task 7: Sufficiency API Route

**Files:**
- Create: `app/api/recipes/sufficiency/route.ts`

- [ ] **Step 7.1: Create the route**

Create `app/api/recipes/sufficiency/route.ts`:

```typescript
import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { checkRecipeSufficiency } from '@/lib/recipes/checkSufficiency'

const InputSchema = z.object({
  recipe_id: z.string().uuid(),
  quantity: z.number().positive().int(),
})

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parsed = InputSchema.parse(body)

    // Derive org_id from authenticated session — never trust the client (Rule S2)
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile?.org_id) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
    }

    const result = await checkRecipeSufficiency(
      parsed.recipe_id,
      parsed.quantity,
      profile.org_id as string
    )

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.errors[0]?.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Sufficiency check failed' }, { status: 500 })
  }
}
```

- [ ] **Step 7.2: Verify build**

```bash
npm run build
```

- [ ] **Step 7.3: Commit**

```bash
git add app/api/recipes/sufficiency/route.ts
git commit -m "feat: add sufficiency check API route"
```

---

### Task 8: RecipeList Component

**Files:**
- Create: `app/(app)/recipes/RecipeList.tsx`

- [ ] **Step 8.1: Create RecipeList.tsx**

Create `app/(app)/recipes/RecipeList.tsx`:

```tsx
'use client'
// Client component: needs useState for client-side search filter

import { useState } from 'react'
import { BookOpen, Plus, ChevronRight, ArrowRight, ListChecks } from 'lucide-react'
import type { RecipeListItem } from '@/types/recipes'

type Props = {
  recipes: RecipeListItem[]
  selectedId: string | null
  label: string
  onSelect: (id: string) => void
  onNew: () => void
}

export function RecipeList({ recipes, selectedId, label, onSelect, onNew }: Props) {
  const [search, setSearch] = useState('')

  const filtered = recipes.filter(
    r =>
      r.name.toLowerCase().includes(search.toLowerCase()) ||
      (r.category ?? '').toLowerCase().includes(search.toLowerCase())
  )

  return (
    <section className="w-80 bg-surface-container-low overflow-y-auto p-6 flex flex-col gap-6 shrink-0">
      <div className="space-y-4">
        <button
          onClick={onNew}
          className="w-full bg-primary-container text-on-primary py-3 rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/20 hover:opacity-90 active:scale-95 transition-all"
        >
          <Plus className="w-4 h-4" />
          New {label}
        </button>
        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-on-surface/40 text-sm select-none">
            ⌕
          </span>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder={`Filter ${label.toLowerCase()}s...`}
            className="w-full pl-9 pr-4 py-2 bg-surface-container-lowest border-none rounded-lg text-xs focus:ring-2 focus:ring-primary-fixed outline-none"
          />
        </div>
      </div>

      {filtered.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center gap-3 py-12">
          <BookOpen className="w-12 h-12 text-on-surface/20" />
          <p className="font-semibold text-on-surface/60">
            {search
              ? `No ${label.toLowerCase()}s match "${search}"`
              : `No ${label.toLowerCase()}s yet`}
          </p>
          {!search && (
            <>
              <p className="text-xs text-on-surface/40">
                Create your first {label.toLowerCase()} to start tracking ingredient usage
              </p>
              <button
                onClick={onNew}
                className="mt-2 px-4 py-2 bg-primary-container text-on-primary rounded-lg text-sm font-bold hover:opacity-90 transition-all"
              >
                New {label}
              </button>
            </>
          )}
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map(recipe => {
            const isSelected = recipe.id === selectedId
            return (
              <button
                key={recipe.id}
                onClick={() => onSelect(recipe.id)}
                className={`w-full text-left p-4 rounded-xl transition-all group ${
                  isSelected
                    ? 'bg-surface-container-lowest shadow-md border-2 border-primary-container'
                    : 'bg-surface-container-lowest shadow-sm border border-transparent hover:border-primary/20'
                }`}
              >
                <div className="flex justify-between items-start mb-2">
                  <h3 className="font-bold text-on-surface">{recipe.name}</h3>
                  {isSelected ? (
                    <ArrowRight className="w-4 h-4 text-primary-container shrink-0" />
                  ) : (
                    <ChevronRight className="w-4 h-4 text-on-surface/30 group-hover:text-primary transition-colors shrink-0" />
                  )}
                </div>
                {recipe.category && (
                  <div className="flex flex-wrap gap-2 mb-3">
                    <span className="px-2 py-0.5 bg-secondary-fixed text-on-secondary-fixed-variant text-[10px] font-bold uppercase tracking-wider rounded">
                      {recipe.category}
                    </span>
                  </div>
                )}
                <div className="flex items-center gap-2 text-xs text-on-surface/60">
                  <ListChecks className="w-4 h-4" />
                  <span className="font-mono">{recipe.ingredient_count}</span> ingredients
                </div>
              </button>
            )
          })}
        </div>
      )}
    </section>
  )
}
```

- [ ] **Step 8.2: Verify build**

```bash
npm run build
```

- [ ] **Step 8.3: Commit**

```bash
git add "app/(app)/recipes/RecipeList.tsx"
git commit -m "feat: add RecipeList component"
```

---

### Task 9: RecipeForm Component

**Files:**
- Create: `app/(app)/recipes/RecipeForm.tsx`

- [ ] **Step 9.1: Create RecipeForm.tsx**

Create `app/(app)/recipes/RecipeForm.tsx`:

```tsx
'use client'
// Client component: dynamic ingredient rows + controlled form state

import { useState, useTransition } from 'react'
import { Plus, X } from 'lucide-react'
import { createRecipeAction, updateRecipeAction } from './actions'
import type { Recipe } from '@/types/recipes'

type InventoryItem = {
  id: string
  name: string
  unit: string
}

type IngredientRow = {
  item_id: string
  quantity: string
  unit: string
}

type Props = {
  label: string
  items: InventoryItem[]
  recipe?: Recipe
  onSuccess: (recipe_id: string) => void
  onCancel: () => void
}

export function RecipeForm({ label, items, recipe, onSuccess, onCancel }: Props) {
  const [isPending, startTransition] = useTransition()
  const [formError, setFormError] = useState<string | null>(null)

  const [name, setName] = useState(recipe?.name ?? '')
  const [category, setCategory] = useState(recipe?.category ?? '')
  const [yieldQty, setYieldQty] = useState(String(recipe?.yield_qty ?? '1'))
  const [yieldUnit, setYieldUnit] = useState(recipe?.yield_unit ?? 'portion')
  const [notes, setNotes] = useState(recipe?.notes ?? '')
  const [sellingPrice, setSellingPrice] = useState(
    recipe?.selling_price != null ? String(recipe.selling_price) : ''
  )
  const [ingredients, setIngredients] = useState<IngredientRow[]>(
    recipe?.ingredients?.length
      ? recipe.ingredients.map(i => ({
          item_id: i.item_id,
          quantity: String(i.quantity),
          unit: i.unit,
        }))
      : [{ item_id: '', quantity: '', unit: '' }]
  )

  function addIngredient() {
    setIngredients(prev => [...prev, { item_id: '', quantity: '', unit: '' }])
  }

  function removeIngredient(index: number) {
    setIngredients(prev => prev.filter((_, i) => i !== index))
  }

  function updateIngredient(index: number, field: keyof IngredientRow, value: string) {
    setIngredients(prev =>
      prev.map((row, i) => {
        if (i !== index) return row
        if (field === 'item_id') {
          const selectedItem = items.find(it => it.id === value)
          // Auto-fill unit from item's base unit when item is selected
          return { ...row, item_id: value, unit: selectedItem?.unit ?? row.unit }
        }
        return { ...row, [field]: value }
      })
    )
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setFormError(null)

    const parsedIngredients = ingredients
      .filter(i => i.item_id && i.quantity && i.unit)
      .map(i => ({
        item_id: i.item_id,
        quantity: Number(i.quantity),
        unit: i.unit,
      }))

    if (parsedIngredients.length === 0) {
      setFormError('Add at least one ingredient with a valid item, quantity, and unit.')
      return
    }

    const payload = {
      name,
      category,
      yield_qty: Number(yieldQty),
      yield_unit: yieldUnit,
      notes,
      selling_price: sellingPrice ? Number(sellingPrice) : null,
      ingredients: parsedIngredients,
    }

    startTransition(async () => {
      const result = recipe
        ? await updateRecipeAction(recipe.id, payload)
        : await createRecipeAction(payload)

      if (!result.success) {
        setFormError(result.error)
        return
      }

      onSuccess('recipe_id' in result ? result.recipe_id : recipe!.id)
    })
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-xl font-bold text-on-surface">
          {recipe ? `Edit ${label}` : `New ${label}`}
        </h3>
        <button
          type="button"
          onClick={onCancel}
          className="p-2 hover:bg-surface-container-low rounded-lg transition-colors"
        >
          <X className="w-5 h-5 text-on-surface/60" />
        </button>
      </div>

      {formError && (
        <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-xl">
          {formError}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="col-span-2 space-y-1">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-on-surface/50">
            {label} name *
          </label>
          <input
            required
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="e.g. Veg Roll"
            className="w-full px-4 py-2 bg-surface-container-lowest border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-fixed outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-on-surface/50">
            Category
          </label>
          <input
            value={category}
            onChange={e => setCategory(e.target.value)}
            placeholder="e.g. Main Course"
            className="w-full px-4 py-2 bg-surface-container-lowest border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-fixed outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-on-surface/50">
            Selling price (₹)
          </label>
          <input
            type="number"
            value={sellingPrice}
            onChange={e => setSellingPrice(e.target.value)}
            placeholder="Optional"
            min="0"
            step="0.01"
            className="w-full px-4 py-2 bg-surface-container-lowest border-none rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-fixed outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-on-surface/50">
            Yield qty *
          </label>
          <input
            required
            type="number"
            value={yieldQty}
            onChange={e => setYieldQty(e.target.value)}
            min="0.0001"
            step="any"
            className="w-full px-4 py-2 bg-surface-container-lowest border-none rounded-lg text-sm font-mono focus:ring-2 focus:ring-primary-fixed outline-none"
          />
        </div>

        <div className="space-y-1">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-on-surface/50">
            Yield unit *
          </label>
          <input
            required
            value={yieldUnit}
            onChange={e => setYieldUnit(e.target.value)}
            placeholder="e.g. portion, tablet, kit"
            className="w-full px-4 py-2 bg-surface-container-lowest border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-fixed outline-none"
          />
        </div>

        <div className="col-span-2 space-y-1">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-on-surface/50">
            Notes
          </label>
          <textarea
            value={notes}
            onChange={e => setNotes(e.target.value)}
            rows={2}
            placeholder="Optional preparation notes..."
            className="w-full px-4 py-2 bg-surface-container-lowest border-none rounded-lg text-sm focus:ring-2 focus:ring-primary-fixed outline-none resize-none"
          />
        </div>
      </div>

      {/* Ingredients table */}
      <div className="space-y-3">
        <p className="text-[10px] uppercase tracking-wider font-semibold text-on-surface/50">
          Ingredients *
        </p>
        <div className="bg-surface-container-lowest rounded-xl overflow-hidden">
          <div className="grid grid-cols-[1fr_100px_100px_32px] px-4 py-2 bg-surface-container-low/50">
            <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface/50">Item</span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface/50">Qty</span>
            <span className="text-[10px] uppercase tracking-wider font-bold text-on-surface/50">Unit</span>
            <span />
          </div>
          {ingredients.map((row, index) => (
            <div
              key={index}
              className="grid grid-cols-[1fr_100px_100px_32px] gap-2 px-4 py-3 hover:bg-surface-container-low/20 transition-colors"
            >
              <select
                value={row.item_id}
                onChange={e => updateIngredient(index, 'item_id', e.target.value)}
                className="bg-transparent border-none text-sm focus:ring-0 outline-none text-on-surface"
              >
                <option value="">Select item...</option>
                {items.map(item => (
                  <option key={item.id} value={item.id}>
                    {item.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                value={row.quantity}
                onChange={e => updateIngredient(index, 'quantity', e.target.value)}
                placeholder="0"
                min="0.0001"
                step="any"
                className="w-full bg-transparent border-none text-sm font-mono focus:ring-0 outline-none text-right pr-2"
              />
              <input
                value={row.unit}
                onChange={e => updateIngredient(index, 'unit', e.target.value)}
                placeholder="g / ml / pcs"
                className="w-full bg-transparent border-none text-sm focus:ring-0 outline-none"
              />
              <button
                type="button"
                onClick={() => removeIngredient(index)}
                disabled={ingredients.length === 1}
                className="text-on-surface/30 hover:text-error transition-colors disabled:opacity-20 disabled:cursor-not-allowed"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          ))}
          <div className="px-4 py-3 border-t border-outline-variant/10">
            <button
              type="button"
              onClick={addIngredient}
              className="flex items-center gap-2 text-primary-container font-bold text-sm px-4 py-2 hover:bg-primary-fixed/30 rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add ingredient
            </button>
          </div>
        </div>
      </div>

      <div className="flex gap-3 pt-2">
        <button
          type="button"
          onClick={onCancel}
          className="px-6 py-3 bg-surface-container-lowest border border-outline-variant/20 rounded-xl font-semibold text-sm hover:bg-surface-container-low transition-colors"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={isPending}
          className="flex-1 bg-primary-container text-on-primary py-3 rounded-xl font-bold hover:opacity-90 active:scale-95 transition-all disabled:opacity-50"
        >
          {isPending ? 'Saving...' : recipe ? 'Save changes' : `Create ${label}`}
        </button>
      </div>
    </form>
  )
}
```

- [ ] **Step 9.2: Verify build**

```bash
npm run build
```

- [ ] **Step 9.3: Commit**

```bash
git add "app/(app)/recipes/RecipeForm.tsx"
git commit -m "feat: add RecipeForm component"
```

---

### Task 10: RecipeDetail Component

**Files:**
- Create: `app/(app)/recipes/RecipeDetail.tsx`

- [ ] **Step 10.1: Create RecipeDetail.tsx**

Create `app/(app)/recipes/RecipeDetail.tsx`:

```tsx
'use client'
// Client component: deduction quantity state, sufficiency preview fetch, archive modal

import { useState, useTransition } from 'react'
import Link from 'next/link'
import { ArrowLeft, Archive, Pencil, Package } from 'lucide-react'
import { deductRecipeAction, archiveRecipeAction } from './actions'
import type { Recipe, SufficiencyResult } from '@/types/recipes'
import { DISPLAY_DECIMAL_PLACES } from '@/lib/constants'

type Props = {
  recipe: Recipe | null
  label: string
  onEdit: () => void
  onArchived: () => void
}

function getStockColor(current: number, reorder: number): string {
  if (current <= 0) return 'text-error'
  if (current <= reorder && reorder > 0) return 'text-amber-600'
  return 'text-emerald-600'
}

function formatQty(n: number): string {
  return Number(n.toFixed(DISPLAY_DECIMAL_PLACES)).toString()
}

export function RecipeDetail({ recipe, label, onEdit, onArchived }: Props) {
  const [isPending, startTransition] = useTransition()
  const [deductQty, setDeductQty] = useState(1)
  const [preview, setPreview] = useState<SufficiencyResult | null>(null)
  const [previewLoading, setPreviewLoading] = useState(false)
  const [deductError, setDeductError] = useState<string | null>(null)
  const [deductSuccess, setDeductSuccess] = useState<string | null>(null)
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false)

  if (!recipe) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center gap-4 text-on-surface/30">
        <ArrowLeft className="w-12 h-12" />
        <p className="font-semibold">Select a {label.toLowerCase()} to view details</p>
      </div>
    )
  }

  async function loadPreview(qty: number) {
    if (!recipe) return
    setPreviewLoading(true)
    setDeductError(null)
    setDeductSuccess(null)
    try {
      const res = await fetch('/api/recipes/sufficiency', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recipe_id: recipe.id, quantity: qty }),
      })
      if (!res.ok) throw new Error('Check failed')
      const data = (await res.json()) as SufficiencyResult
      setPreview(data)
    } catch {
      setDeductError('Could not check stock levels. Try again.')
    } finally {
      setPreviewLoading(false)
    }
  }

  function handleQtyChange(qty: number) {
    setDeductQty(qty)
    setPreview(null)
    setDeductError(null)
    setDeductSuccess(null)
  }

  function handleDeduct() {
    if (!recipe) return
    setDeductError(null)
    setDeductSuccess(null)
    startTransition(async () => {
      const result = await deductRecipeAction({
        recipe_id: recipe.id,
        quantity: deductQty,
        note: '',
      })

      if (!result.success) {
        setDeductError(result.error)
        if ('insufficiency' in result && result.insufficiency) {
          setPreview(result.insufficiency)
        }
        return
      }

      setPreview(null)
      const alerts =
        result.low_stock_alerts.length > 0
          ? ` Low stock alert: ${result.low_stock_alerts.join(', ')}.`
          : ''
      setDeductSuccess(`Stock updated successfully.${alerts}`)
      setDeductQty(1)
    })
  }

  function handleArchive() {
    startTransition(async () => {
      const result = await archiveRecipeAction({ recipe_id: recipe!.id })
      if (result.success) onArchived()
      setShowArchiveConfirm(false)
    })
  }

  const enoughForRecipe =
    recipe.ingredients.length > 0
      ? Math.min(
          ...recipe.ingredients.map(ing => {
            const per_run = ing.quantity * ing.unit_multiplier
            return per_run > 0 ? Math.floor(ing.current_stock / per_run) : 0
          })
        )
      : 0

  return (
    <section className="flex-1 overflow-y-auto bg-surface p-8">
      <div className="max-w-4xl mx-auto space-y-8">
        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
          <div className="space-y-2">
            <h2 className="text-4xl font-black text-on-surface">{recipe.name}</h2>
            <div className="flex flex-wrap items-center gap-3">
              {recipe.category && (
                <span className="px-2 py-0.5 bg-secondary-fixed text-on-secondary-fixed-variant text-[10px] font-bold uppercase tracking-wider rounded">
                  {recipe.category}
                </span>
              )}
              <span className="text-sm text-on-surface/50">
                Makes <span className="font-mono">{recipe.yield_qty}</span> {recipe.yield_unit} per use
              </span>
              {enoughForRecipe > 0 && (
                <span className="text-sm text-emerald-600 font-semibold font-mono">
                  Enough for {enoughForRecipe} use{enoughForRecipe === 1 ? '' : 's'}
                </span>
              )}
            </div>
            {recipe.notes && (
              <p className="text-sm italic text-on-surface/50">{recipe.notes}</p>
            )}
          </div>
          <div className="flex gap-2 shrink-0">
            <button
              onClick={onEdit}
              className="p-2 bg-surface-container-lowest border border-outline-variant/20 rounded-lg hover:bg-surface-container-low transition-colors"
              title={`Edit ${label.toLowerCase()}`}
            >
              <Pencil className="w-5 h-5 text-on-surface/70" />
            </button>
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="p-2 bg-surface-container-lowest border border-outline-variant/20 rounded-lg hover:bg-surface-container-low transition-colors"
              title={`Archive ${label.toLowerCase()}`}
            >
              <Archive className="w-5 h-5 text-on-surface/70" />
            </button>
          </div>
        </div>

        {/* Archive confirm modal — no browser confirm() per Rule U9 */}
        {showArchiveConfirm && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-sm w-full space-y-4 shadow-[0_12px_32px_-4px_rgba(27,28,22,0.06)]">
              <h4 className="font-bold text-on-surface">Archive {label}?</h4>
              <p className="text-sm text-on-surface/60">
                &ldquo;{recipe.name}&rdquo; will be hidden from the list. All past transactions are
                preserved.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="flex-1 px-4 py-2 border border-outline-variant/20 rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={handleArchive}
                  disabled={isPending}
                  className="flex-1 px-4 py-2 bg-error text-on-error rounded-xl text-sm font-bold hover:opacity-90 transition-colors disabled:opacity-50"
                >
                  Archive
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Ingredients table */}
        <div
          className="bg-surface-container-lowest rounded-xl overflow-hidden"
          style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
        >
          <table className="w-full text-left">
            <thead>
              <tr className="bg-surface-container-low/50">
                <th className="px-6 py-4 text-[10px] uppercase tracking-wider font-bold text-on-surface/60">
                  Ingredient
                </th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-wider font-bold text-on-surface/60">
                  Qty
                </th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-wider font-bold text-on-surface/60">
                  Unit
                </th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-wider font-bold text-on-surface/60">
                  Current Stock
                </th>
                <th className="px-6 py-4 text-[10px] uppercase tracking-wider font-bold text-on-surface/60">
                  Enough For
                </th>
              </tr>
            </thead>
            <tbody>
              {recipe.ingredients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-on-surface/40 text-sm">
                    No ingredients. Edit this {label.toLowerCase()} to add some.
                  </td>
                </tr>
              ) : (
                recipe.ingredients.map(ing => {
                  const per_run = ing.quantity * ing.unit_multiplier
                  const enough_for = per_run > 0 ? Math.floor(ing.current_stock / per_run) : 0
                  const stockColor = getStockColor(ing.current_stock, ing.reorder_point)
                  const enoughBadge =
                    enough_for > 5
                      ? 'bg-emerald-50 text-emerald-700'
                      : enough_for >= 1
                        ? 'bg-tertiary-fixed text-on-tertiary-fixed'
                        : 'bg-error/10 text-error'

                  return (
                    <tr
                      key={ing.id}
                      className="hover:bg-surface-container-low/20 transition-colors"
                    >
                      <td className="px-6 py-4 font-medium">
                        <Link
                          href={`/inventory/${ing.item_id}`}
                          className="hover:text-primary-container transition-colors"
                        >
                          {ing.item_name}
                        </Link>
                      </td>
                      <td className="px-6 py-4 font-mono">{formatQty(ing.quantity)}</td>
                      <td className="px-6 py-4 text-xs text-on-surface/60">{ing.unit}</td>
                      <td className={`px-6 py-4 font-mono font-semibold ${stockColor}`}>
                        {formatQty(ing.current_stock)}{ing.item_unit}
                      </td>
                      <td className="px-6 py-4">
                        <span className={`px-2 py-1 rounded text-xs font-bold font-mono ${enoughBadge}`}>
                          {enough_for} use{enough_for === 1 ? '' : 's'}
                        </span>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Deduction / Impact Preview section */}
        <div className="bg-secondary-fixed/20 rounded-2xl p-6 border border-primary-container/10 space-y-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <h4 className="text-lg font-bold text-primary-container">Impact Preview</h4>
            <div className="flex items-center gap-3">
              <span className="text-xs font-medium text-on-surface/60">
                How many {recipe.yield_unit}s did you make?
              </span>
              <input
                type="number"
                value={deductQty}
                min={1}
                step={1}
                onChange={e =>
                  handleQtyChange(Math.max(1, parseInt(e.target.value, 10) || 1))
                }
                className="w-16 bg-surface-container-lowest border-none rounded-lg text-sm px-3 py-1 font-mono focus:ring-1 focus:ring-primary outline-none text-center"
              />
            </div>
          </div>

          {!preview && !previewLoading && (
            <button
              onClick={() => loadPreview(deductQty)}
              className="text-sm text-primary-container font-semibold hover:underline"
            >
              Check stock availability →
            </button>
          )}

          {previewLoading && (
            <p className="text-sm text-on-surface/40 animate-pulse">Checking stock levels...</p>
          )}

          {preview && (
            <div className="space-y-4">
              {!preview.can_proceed && (
                <div className="bg-error/10 border border-error/20 rounded-xl px-4 py-3 text-sm text-error font-semibold">
                  Cannot deduct — insufficient stock for:{' '}
                  {preview.ingredients
                    .filter(i => !i.is_sufficient)
                    .map(i => i.item_name)
                    .join(', ')}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface/40">
                    Will use
                  </p>
                  {preview.ingredients.map(ing => (
                    <p key={ing.item_id} className="text-sm text-on-surface/80">
                      <span className="font-mono text-primary-container">
                        {formatQty(ing.required_qty)}{ing.unit}
                      </span>{' '}
                      {ing.item_name}
                    </p>
                  ))}
                </div>
                <div className="space-y-2">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-on-surface/40">
                    Remaining after
                  </p>
                  {preview.ingredients.map(ing => {
                    const remaining = ing.available_qty - ing.required_qty
                    const isNeg = remaining < 0
                    const color = !ing.is_sufficient ? 'text-error' : 'text-on-surface'
                    return (
                      <p key={ing.item_id} className="text-sm">
                        <span className={`font-mono font-bold ${color}`}>
                          {formatQty(Math.max(0, remaining))}{ing.unit}
                        </span>{' '}
                        <span className="text-on-surface/60">{ing.item_name}</span>
                        {isNeg && (
                          <span className="ml-2 text-error text-xs font-bold">
                            ✗ need {formatQty(ing.shortfall)}{ing.unit} more
                          </span>
                        )}
                      </p>
                    )
                  })}
                </div>
              </div>

              {/* Reorder warning — amber pill per design system */}
              {preview.can_proceed &&
                preview.ingredients.some(i => i.enough_for <= deductQty && i.enough_for > 0) && (
                  <div className="bg-tertiary-fixed p-4 rounded-xl flex items-center gap-3 border border-tertiary-container/10">
                    <Package className="w-5 h-5 text-tertiary shrink-0" />
                    <p className="text-sm font-bold text-on-tertiary-fixed">
                      Some items will drop below their reorder point after this deduction.
                    </p>
                  </div>
                )}
            </div>
          )}

          {deductSuccess && (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm px-4 py-3 rounded-xl font-semibold">
              {deductSuccess}
            </div>
          )}

          {deductError && !preview && (
            <div className="bg-error/10 border border-error/20 text-error text-sm px-4 py-3 rounded-xl">
              {deductError}
            </div>
          )}

          <button
            onClick={handleDeduct}
            disabled={isPending || (preview !== null && !preview.can_proceed)}
            className="w-full bg-primary-container text-on-primary py-4 rounded-xl font-bold flex items-center justify-center gap-3 shadow-xl shadow-primary/30 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:cursor-not-allowed"
          >
            <Package className="w-5 h-5" />
            {isPending
              ? 'Deducting...'
              : `Deduct ${deductQty}× ${recipe.name} from stock`}
          </button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 10.2: Verify build**

```bash
npm run build
```

Fix any TypeScript errors before continuing.

- [ ] **Step 10.3: Commit**

```bash
git add "app/(app)/recipes/RecipeDetail.tsx"
git commit -m "feat: add RecipeDetail component with deduction UI"
```

---

### Task 11: Page, Layout Wrapper, Loading, Error

**Files:**
- Create: `app/(app)/recipes/RecipesLayout.tsx`
- Create: `app/(app)/recipes/page.tsx`
- Create: `app/(app)/recipes/loading.tsx`
- Create: `app/(app)/recipes/error.tsx`

- [ ] **Step 11.1: Create RecipesLayout.tsx**

Create `app/(app)/recipes/RecipesLayout.tsx`:

```tsx
'use client'
// Client component: manages selected recipe ID, view/create/edit mode

import { useState } from 'react'
import { RecipeList } from './RecipeList'
import { RecipeDetail } from './RecipeDetail'
import { RecipeForm } from './RecipeForm'
import type { Recipe, RecipeListItem } from '@/types/recipes'

type InventoryItem = { id: string; name: string; unit: string }

type Props = {
  recipes: RecipeListItem[]
  allRecipes: Recipe[]
  items: InventoryItem[]
  label: string
}

type Mode = 'view' | 'create' | 'edit'

export function RecipesLayout({ recipes, allRecipes, items, label }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(recipes[0]?.id ?? null)
  const [mode, setMode] = useState<Mode>('view')
  const [recipeList, setRecipeList] = useState<RecipeListItem[]>(recipes)
  const [fullRecipes, setFullRecipes] = useState<Recipe[]>(allRecipes)

  const selectedRecipe = fullRecipes.find(r => r.id === selectedId) ?? null

  function handleSelect(id: string) {
    setSelectedId(id)
    setMode('view')
  }

  function handleNew() {
    setSelectedId(null)
    setMode('create')
  }

  function handleEdit() {
    setMode('edit')
  }

  function handleFormSuccess(_recipe_id: string) {
    // Trigger a full page refresh to pull fresh data from the server
    window.location.reload()
  }

  function handleArchived() {
    const nextId = recipeList.find(r => r.id !== selectedId)?.id ?? null
    setRecipeList(prev => prev.filter(r => r.id !== selectedId))
    setFullRecipes(prev => prev.filter(r => r.id !== selectedId))
    setSelectedId(nextId)
    setMode('view')
  }

  const rightPanel =
    mode === 'create' || mode === 'edit' ? (
      <section className="flex-1 overflow-y-auto bg-surface p-8">
        <div className="max-w-2xl mx-auto">
          <RecipeForm
            label={label}
            items={items}
            recipe={mode === 'edit' ? (selectedRecipe ?? undefined) : undefined}
            onSuccess={handleFormSuccess}
            onCancel={() => setMode('view')}
          />
        </div>
      </section>
    ) : (
      <RecipeDetail
        recipe={selectedRecipe}
        label={label}
        onEdit={handleEdit}
        onArchived={handleArchived}
      />
    )

  return (
    <div className="flex-1 flex overflow-hidden">
      <RecipeList
        recipes={recipeList}
        selectedId={selectedId}
        label={label}
        onSelect={handleSelect}
        onNew={handleNew}
      />
      {rightPanel}
    </div>
  )
}
```

- [ ] **Step 11.2: Create page.tsx**

Create `app/(app)/recipes/page.tsx`:

```tsx
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
    yield_unit: r.yield_unit,
    ingredient_count: Array.isArray(r.recipe_ingredients)
      ? ((r.recipe_ingredients[0] as { count: number })?.count ?? 0)
      : 0,
    is_archived: r.is_archived,
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

  const fullRecipes: Recipe[] = (rawFullRecipes ?? []).map(r => ({
    id: r.id,
    org_id: r.org_id,
    name: r.name,
    category: r.category,
    yield_qty: Number(r.yield_qty),
    yield_unit: r.yield_unit,
    notes: r.notes,
    selling_price: r.selling_price != null ? Number(r.selling_price) : null,
    is_archived: r.is_archived,
    created_at: r.created_at,
    updated_at: r.updated_at,
    ingredients: (r.recipe_ingredients ?? []).map(ing => {
      const item = ing.items as {
        name: string
        current_stock: number
        unit: string
        reorder_point: number
        cost_per_unit: number | null
      } | null

      return {
        id: ing.id,
        org_id: ing.org_id,
        recipe_id: ing.recipe_id,
        item_id: ing.item_id,
        quantity: Number(ing.quantity),
        unit: ing.unit,
        unit_multiplier: Number(ing.unit_multiplier),
        created_at: ing.created_at,
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
```

- [ ] **Step 11.3: Create loading.tsx**

Create `app/(app)/recipes/loading.tsx`:

```tsx
export default function RecipesLoading() {
  return (
    <main className="ml-60 flex-1 flex flex-col min-h-screen">
      <header className="sticky top-0 z-30 bg-surface px-8 py-4">
        <div className="h-9 w-32 bg-surface-container-low rounded-lg animate-pulse" />
      </header>
      <div className="flex-1 flex overflow-hidden">
        <section className="w-80 bg-surface-container-low p-6 flex flex-col gap-4 shrink-0">
          <div className="h-12 bg-surface-container rounded-xl animate-pulse" />
          <div className="h-9 bg-surface-container rounded-lg animate-pulse" />
          {[1, 2, 3].map(i => (
            <div key={i} className="h-24 bg-surface-container-lowest rounded-xl animate-pulse" />
          ))}
        </section>
        <section className="flex-1 bg-surface p-8 space-y-6">
          <div className="h-12 w-64 bg-surface-container-low rounded-lg animate-pulse" />
          <div className="h-64 bg-surface-container-low rounded-xl animate-pulse" />
          <div className="h-48 bg-surface-container-low rounded-2xl animate-pulse" />
        </section>
      </div>
    </main>
  )
}
```

- [ ] **Step 11.4: Create error.tsx**

Create `app/(app)/recipes/error.tsx`:

```tsx
'use client'
// Client component: required by Next.js error boundary

import { useEffect } from 'react'
import { AlertTriangle } from 'lucide-react'

type Props = {
  error: Error & { digest?: string }
  reset: () => void
}

export default function RecipesError({ error, reset }: Props) {
  useEffect(() => {
    console.error('[RecipesError]', error.message)
  }, [error])

  return (
    <main className="ml-60 flex-1 flex flex-col items-center justify-center gap-6 min-h-screen">
      <AlertTriangle className="w-12 h-12 text-error/60" />
      <div className="text-center space-y-2">
        <h3 className="text-lg font-bold text-on-surface">Could not load recipes</h3>
        <p className="text-sm text-on-surface/60 max-w-sm">
          Something went wrong while loading your recipes. Your data is safe.
        </p>
      </div>
      <button
        onClick={reset}
        className="px-6 py-3 bg-primary-container text-on-primary rounded-xl font-bold hover:opacity-90 transition-all"
      >
        Try again
      </button>
    </main>
  )
}
```

- [ ] **Step 11.5: Verify build**

```bash
npm run build
```

Fix any TypeScript errors. Common issues to check:
- Supabase nested select types may need manual casting — cast using `as` with explicit type annotation
- `recipe_ingredients(count)` returns an array; access `[0].count`

- [ ] **Step 11.6: Commit**

```bash
git add "app/(app)/recipes/RecipesLayout.tsx" "app/(app)/recipes/page.tsx" "app/(app)/recipes/loading.tsx" "app/(app)/recipes/error.tsx"
git commit -m "feat: add recipes page, layout, loading, and error boundary"
```

---

### Task 12: Verification

- [ ] **Step 12.1: Final clean build**

```bash
npm run build
```

Expected: Exit code 0. No TypeScript errors, no lint errors.

- [ ] **Step 12.2: Verify migration applied**

In Supabase Dashboard → SQL Editor:

```sql
select column_name from information_schema.columns
where table_name = 'recipes' and column_name = 'selling_price';

select proname from pg_proc
where proname in (
  'create_recipe_with_ingredients',
  'update_recipe_with_ingredients',
  'deduct_recipe'
);
```

Expected: Both queries return results.

- [ ] **Step 12.3: Create test recipe**

```bash
npm run dev
```

1. Navigate to `/recipes`
2. Click "New Recipe"
3. Fill in: Name = "Veg Roll", Category = "Street Food", Yield = 1 portion
4. Add ingredients: Paneer Fresh 100 g, Maida 50 g, Mayonnaise 2 g
5. Click "Create Recipe"

Expected: Recipe appears in left list; right panel shows detail with ingredients table.

- [ ] **Step 12.4: Test deduction preview**

1. Select "Veg Roll"
2. Set quantity to 3
3. Click "Check stock availability"

Expected: Preview shows Will Use: 300g Paneer, 150g Maida, 6g Mayonnaise. Remaining quantities colour-coded.

- [ ] **Step 12.5: Test deduction commit**

1. Click "Deduct 3× Veg Roll from stock"

Expected:
- Success banner appears
- Navigate to `/inventory` — stock for Paneer, Maida, Mayonnaise decreased
- Navigate to `/dashboard` — 3 new `recipe_deduction` transactions visible

- [ ] **Step 12.6: Test insufficient stock**

1. Enter quantity 10000
2. Click "Check stock availability"

Expected: Red error banner listing short items. Deduct button disabled.

- [ ] **Step 12.7: Test low stock trigger**

After deduction drops any item below its `reorder_point`:

In Supabase Dashboard → Table Editor → `agent_actions`:

Expected: Row with `agent_type = 'reorder'`, `status = 'pending'`, correct `item_id` in payload.

- [ ] **Step 12.8: Final commit**

```bash
git add -A
git commit -m "feat: recipe engine complete — Task 7 done"
```

---

## Self-Review Checklist

### Spec Coverage

| Requirement | Task |
|-------------|------|
| Migration 006 with deduct_recipe RPC | Task 1 |
| createRecipeAction with Zod + org verify | Task 6 |
| updateRecipeAction (delete + reinsert) | Task 6 |
| archiveRecipeAction (is_archived = true, no hard delete) | Task 6 |
| deductRecipeAction — server-side re-check | Task 6 |
| Sufficiency check POST route | Task 7 |
| RecipeList with search + empty state | Task 8 |
| RecipeForm with dynamic ingredient rows | Task 9 |
| RecipeDetail with preview + deduction | Task 10 |
| page.tsx — Server Component | Task 11 |
| loading.tsx skeleton | Task 11 |
| error.tsx with retry | Task 11 |
| `getUnitMultiplier` utility | Task 3 |
| `checkRecipeSufficiency` | Task 4 |
| `calculateRecipeCost` | Task 5 |
| Low stock → agent_actions insert | Task 6 (deductRecipeAction) |
| Archive confirm modal (no browser alert) | Task 10 |
| Quantities font-mono everywhere | Tasks 8, 9, 10 |
| No 1px borders in ingredient table | Tasks 10, 11 |
| Status colors from design system | Task 10 |
| Industry label (Recipe/Formula/BOM) | Tasks 8, 9, 10, 11 |
| selling_price column + field | Tasks 1, 9 |

### Type Consistency

- `SufficiencyResult` defined in `types/recipes.ts` → used in `checkSufficiency.ts`, `actions.ts`, `RecipeDetail.tsx`, `route.ts` ✓
- `Recipe.ingredients` is `RecipeIngredient[]` → used in `RecipeDetail.tsx`, `RecipesLayout.tsx` ✓
- `createRecipeAction` returns `{ success: true; recipe_id: string }` → consumed in `RecipeForm.tsx` with `'recipe_id' in result` guard ✓
- `deductRecipeAction` returns `insufficiency?: SufficiencyResult` → consumed in `RecipeDetail.tsx` ✓
- `getOrgAndUser()` return type matches `resolveIngredients()` first parameter ✓

### Rules Verified

- D1: All stock changes via `transactions` inserts in `deduct_recipe` RPC; trigger handles `current_stock` ✓
- D2: Recipe create/update/deduct all use single RPCs ✓
- S2: `org_id` always from authenticated session in actions and route ✓
- L3: No LLM in this module — N/A ✓
- U9: Archive uses modal dialog, not browser confirm() ✓
- Q5: All constants from `/lib/constants.ts` ✓
- N4: Both `loading.tsx` and `error.tsx` created ✓
- F4: No barrel index files ✓
