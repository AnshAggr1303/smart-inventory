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
      if (recipe) {
        const result = await updateRecipeAction(recipe.id, payload)
        if (!result.success) {
          setFormError(result.error)
          return
        }
        onSuccess(recipe.id)
      } else {
        const result = await createRecipeAction(payload)
        if (!result.success) {
          setFormError(result.error)
          return
        }
        onSuccess(result.recipe_id)
      }
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
