## SECTION 6: RECIPE / FORMULA ENGINE MODULE

---

### Overview

The recipe engine has two jobs:

1. DEFINITION — let users create and manage recipes/formulas
   that describe exactly what ingredients or materials are
   consumed to produce one unit of output

2. DEDUCTION — when a user records that they made or sold
   something, automatically subtract the correct quantities
   of every ingredient from live stock, respecting units
   and checking for insufficient stock before committing

The word "recipe" is used throughout this document but the
UI label changes by industry (see Section 1 industry config):
- restaurant / hotel   → "Recipe"
- pharmacy             → "Formula"
- manufacturing        → "Bill of Materials"
- retail / other       → "Usage Template"

The underlying data model and logic is identical regardless
of label.

---

### Part 1 — Recipe definition

#### Creating a recipe

Server Action: /app/(app)/recipes/actions.ts → createRecipe()

Input:
```typescript
type CreateRecipeInput = {
  org_id: string
  name: string
  category: string
  yield_qty: number       // how many units this recipe makes
  yield_unit: string      // e.g. "portion", "tablet", "kit"
  notes?: string
  ingredients: {
    item_id: string
    quantity: number
    unit: string
  }[]
}
```

Validation rules (server-side):
- name: required, min 2 chars, max 100 chars
- yield_qty: required, must be > 0
- yield_unit: required
- ingredients: must have at least 1 ingredient
- Each ingredient quantity must be > 0
- Each ingredient unit must exist in unit_conversions or
  match the item's base unit exactly
- Ingredient item_id must belong to the same org_id —
  never trust item_id from client without verifying org

On save:
1. Insert row into recipes table
2. Insert one row per ingredient into recipe_ingredients
3. Both in a single Supabase transaction — all or nothing

#### Editing a recipe

When a recipe is edited:
- Update the recipes row
- Delete ALL existing recipe_ingredients for that recipe
- Re-insert all ingredients fresh

Never try to diff and patch individual ingredient rows.
Delete and re-insert is simpler, safer, and avoids
partial update bugs.

#### Archiving a recipe

Set recipes.is_archived = true.
Do not delete recipes — they are referenced in past
transactions and are needed for audit history.
Archived recipes are hidden from the UI by default
but accessible via a "Show archived" toggle.

---

### Part 2 — Recipe deduction

This is the core engine. When a user records usage of a
recipe, the system must:

1. Validate — check every ingredient has enough stock
2. Calculate — compute exact quantities to deduct using
   unit conversion
3. Preview — show the user exactly what will be deducted
   before committing
4. Commit — insert transactions for every ingredient
   atomically

#### Step 1 — Pre-deduction validation

Before showing the confirmation preview, run a stock
sufficiency check on the server.
```typescript
// /lib/recipes/checkSufficiency.ts

type SufficiencyResult = {
  can_proceed: boolean
  ingredients: {
    item_id: string
    item_name: string
    required_qty: number      // in item base unit
    available_qty: number     // items.current_stock
    is_sufficient: boolean
    shortfall: number         // 0 if sufficient
    unit: string
  }[]
}

async function checkRecipeSufficiency(
  recipe_id: string,
  quantity: number,       // how many times to run recipe
  org_id: string
): Promise<SufficiencyResult>
```

Logic:
- For each ingredient in the recipe:
  required = ingredient.quantity × quantity × unit_multiplier
  available = items.current_stock (in base unit)
  is_sufficient = available >= required
- can_proceed = all ingredients are sufficient
- Return full breakdown regardless of can_proceed so UI
  can show exactly what is short

#### Step 2 — Deduction preview UI

Show the user a preview card before any DB write:

"Deducting 3 × Veg Roll will use:"
- Paneer    300g    (340g available → 40g remaining) ⚠
- Maida     150g    (680g available → 530g remaining) ✓
- Mayo      6g      (120g available → 114g remaining) ✓

Colour coding:
- Remaining > reorder_point → green ✓
- Remaining < reorder_point but > 0 → amber ⚠
  "Paneer will fall below reorder point"
- Remaining would go negative → red ✗
  "Not enough Paneer. You have 340g, need 300g."
  Block confirmation if any ingredient goes negative.
  Never allow stock to go below zero via recipe deduction.

If can_proceed is false:
- Show red banner: "Cannot deduct — insufficient stock
  for [item names]"
- Disable confirm button
- Show "Record anyway" ghost link — this triggers a
  manual_deduction with a note "Recorded with insufficient
  stock" and sets current_stock to 0 for that item, not
  negative. Use this escape hatch sparingly.

#### Step 3 — Commit deduction (Server Action)
```typescript
// /app/(app)/recipes/actions.ts

async function deductRecipe(
  recipe_id: string,
  quantity: number,       // how many times recipe was used
  org_id: string,
  user_id: string,
  note?: string
): Promise<{ success: boolean; transactions_created: number }>
```

Logic inside the Server Action:

1. Re-run sufficiency check server-side (never trust the
   client's check — user could have modified the request)

2. If insufficient → throw InsufficientStockError with
   details. Never proceed.

3. Build transaction rows for every ingredient:
```typescript
   {
     org_id,
     item_id: ingredient.item_id,
     type: 'recipe_deduction',
     quantity: -(ingredient.quantity * quantity),
     // negative because it's a deduction
     unit: ingredient.unit,
     unit_multiplier: getMultiplier(ingredient.unit,
                                    item.unit),
     recipe_id: recipe_id,
     performed_by: user_id,
     note: note ?? `${quantity}× ${recipe.name}`
   }
```

4. Insert all transaction rows in a single Supabase RPC
   transaction — all succeed or all fail together

5. Postgres trigger fires for each inserted transaction
   and updates items.current_stock automatically

6. After successful commit:
   - Check if any ingredient is now below reorder_point
   - If yes → create an agent_action row with type
     'reorder' and status 'pending' for each affected item
   - This is what feeds the reorder agent (see Section 7)

7. Return success + count of transactions created

---

### Part 3 — Unit conversion in deductions

Unit conversion is critical and must be exact.
Every deduction must convert from the recipe's ingredient
unit to the item's base unit before writing to the DB.
```typescript
// /lib/units/convertUnit.ts

async function getUnitMultiplier(
  from_unit: string,
  to_unit: string
): Promise<number>
// Looks up unit_conversions table
// Throws UnitConversionNotFoundError if pair not in table
// Special case: if from_unit === to_unit, return 1

function convertQuantity(
  quantity: number,
  from_unit: string,
  to_unit: string,
  multiplier: number
): number
// quantity × multiplier, rounded to 4 decimal places
// Never store more than 4 decimal places in the DB
```

Examples that must work correctly:
- Recipe uses 100g, item base unit is kg:
  multiplier = 0.001, stored quantity = -0.1 kg
- Recipe uses 2 strips of 10 tablets, item base unit tabs:
  multiplier = 10, stored quantity = -20 tabs
- Recipe uses 500ml, item base unit is l:
  multiplier = 0.001, stored quantity = -0.5 l
- Recipe uses 2 pcs, item base unit is pcs:
  multiplier = 1, stored quantity = -2 pcs

If a unit pair is not in unit_conversions:
- Server Action throws UnitConversionNotFoundError
- UI shows: "Unit mismatch for [item]. Please check the
  recipe unit matches the item's unit."
- Do not proceed with deduction

---

### Part 4 — Recipe cost and margin calculation

Every recipe has a live COGS (cost of goods sold) that
updates automatically as ingredient prices change.
```typescript
// /lib/recipes/calculateCost.ts

type RecipeCostResult = {
  recipe_id: string
  cost_per_yield: number      // total ingredient cost for 1 yield
  currency: 'INR'
  breakdown: {
    item_id: string
    item_name: string
    quantity: number
    unit: string
    cost_per_unit: number     // from items.cost_per_unit
    line_cost: number         // quantity × cost_per_unit
  }[]
  last_updated: string        // ISO timestamp of most recent
                              // cost_per_unit update
}

async function calculateRecipeCost(
  recipe_id: string,
  org_id: string
): Promise<RecipeCostResult>
```

`items.cost_per_unit` is updated every time a bill is
confirmed (takes the latest price from the bill).
So recipe COGS updates automatically every time you
receive a new bill — no manual input needed.

Margin calculation (UI only — not stored in DB):
```typescript
// In the recipe detail component only
const margin_pct = selling_price
  ? ((selling_price - cost_per_yield) / selling_price) * 100
  : null
```

Selling price is entered manually by the user in the recipe
detail UI. It is stored in recipes.selling_price (add this
column — numeric(10,2), nullable). It is never calculated
automatically.

---

### Part 5 — Bulk deduction (end of day)

Restaurant owners often want to record total output at end
of day rather than item by item throughout the day.

UI: "Record sales" button on dashboard and recipes page.
Shows a simple form:
- Recipe name (dropdown)
- Quantity sold (number input)
- [+ Add another recipe] link
- "Deduct all" primary button

This calls deductRecipe() once per recipe line.
Each deduction is a separate set of transactions with its
own recipe_id and timestamp.
They are not grouped — each is independently auditable.

---

### Recipe suggestion on low stock / expiry

When an item is near expiry (earliest_expiry within 3 days)
the system suggests recipes that use that item:
```typescript
// /lib/recipes/suggestByItem.ts

async function getRecipesUsingItem(
  item_id: string,
  org_id: string
): Promise<{ recipe_id: string; recipe_name: string;
             qty_needed: number; unit: string }[]>
```

This is shown as a banner on the item detail page:
"Paneer expires in 2 days. Use it in:
 Veg Roll (needs 100g) · Butter Paneer (needs 200g)"

---

### Error types for this module
```typescript
// /lib/recipes/errors.ts

class InsufficientStockError extends Error {
  constructor(public items: { name: string;
    shortfall: number; unit: string }[]) { super() }
}
class RecipeNotFoundError extends Error {}
class UnitConversionNotFoundError extends Error {
  constructor(public from: string, public to: string)
  { super() }
}
class EmptyRecipeError extends Error {}
// thrown if recipe has 0 ingredients
```

---

### Files Claude Code must create for this module

/app/(app)/recipes/
  page.tsx              ← recipe list + detail split view
  actions.ts            ← createRecipe, deductRecipe,
                           archiveRecipe Server Actions
  RecipeList.tsx        ← left panel, searchable list
  RecipeDetail.tsx      ← right panel, ingredients table
  DeductModal.tsx       ← quantity input + preview card
  BulkDeductForm.tsx    ← end of day recording form

/lib/recipes/
  checkSufficiency.ts   ← pre-deduction stock check
  calculateCost.ts      ← COGS + margin calculation
  suggestByItem.ts      ← expiry-based recipe suggestions
  errors.ts             ← recipe-specific error classes

/lib/units/
  convertUnit.ts        ← unit multiplier lookup