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
