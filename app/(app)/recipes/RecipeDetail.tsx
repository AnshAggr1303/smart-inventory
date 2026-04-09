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
              className="p-2 bg-surface-container-lowest border border-outline-variant/15 rounded-lg hover:bg-surface-container-low transition-colors"
              title={`Edit ${label.toLowerCase()}`}
            >
              <Pencil className="w-5 h-5 text-on-surface/70" />
            </button>
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="p-2 bg-surface-container-lowest border border-outline-variant/15 rounded-lg hover:bg-surface-container-low transition-colors"
              title={`Archive ${label.toLowerCase()}`}
            >
              <Archive className="w-5 h-5 text-on-surface/70" />
            </button>
          </div>
        </div>

        {/* Archive confirm modal — no browser confirm() per Rule U9 */}
        {showArchiveConfirm && (
          <div className="fixed inset-0 bg-black/30 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-surface-container-lowest rounded-2xl p-6 max-w-sm w-full space-y-4" style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}>
              <h4 className="font-bold text-on-surface">Archive {label}?</h4>
              <p className="text-sm text-on-surface/60">
                &ldquo;{recipe.name}&rdquo; will be hidden from the list. All past transactions are
                preserved.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowArchiveConfirm(false)}
                  className="flex-1 px-4 py-2 border border-outline-variant/15 rounded-xl text-sm font-semibold hover:bg-surface-container-low transition-colors"
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
            className="w-full bg-gradient-to-r from-primary to-primary-container text-on-primary py-4 rounded-xl font-bold flex items-center justify-center gap-3 hover:-translate-y-0.5 transition-all disabled:opacity-50 disabled:translate-y-0 disabled:cursor-not-allowed"
            style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
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
