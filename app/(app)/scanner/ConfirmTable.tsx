// app/(app)/scanner/ConfirmTable.tsx
'use client'
// Client component: manages editable table state for bill confirmation

import { useState } from 'react'
import { AlertTriangle, X, Plus, ArrowRight } from 'lucide-react'
import type { NormalisedItem } from '@/lib/ocr/normaliseItems'

export type ConfirmedItem = {
  item_id: string | null
  name: string
  quantity: number
  unit: string
  price_per_unit: number | null
  is_new_item: boolean
}

export type BillMeta = {
  supplier_name: string
  bill_date: string
  bill_number: string
}

type EditableRow = {
  id: string              // local key for React
  item_id: string | null
  name: string
  quantity: string        // string so empty is valid during editing
  unit: string
  price: string           // string so empty is valid during editing
  is_new_item: boolean
  confidence_score: number
}

const COMMON_UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'tabs', 'strips', 'pkt', 'box', 'dozen']

function today(): string {
  return new Date().toISOString().split('T')[0] ?? ''
}

type Props = {
  items: NormalisedItem[]
  fallbackUsed: boolean
  onConfirm: (items: ConfirmedItem[], meta: BillMeta) => void
  onDiscard: () => void
  isSubmitting: boolean
}

export default function ConfirmTable({
  items,
  fallbackUsed,
  onConfirm,
  onDiscard,
  isSubmitting,
}: Props) {
  const [rows, setRows] = useState<EditableRow[]>(() =>
    items.map((item, idx) => ({
      id: `row-${idx}`,
      item_id: item.matched_item_id,
      name: item.clean_name,
      quantity: item.quantity != null ? String(item.quantity) : '',
      unit: item.unit,
      price: item.price_per_unit != null ? String(item.price_per_unit) : '',
      is_new_item: item.is_new_item,
      confidence_score: item.confidence_score,
    }))
  )

  const [meta, setMeta] = useState<BillMeta>({
    supplier_name: '',
    bill_date: today(),
    bill_number: '',
  })

  function updateRow(id: string, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  function addEmptyRow() {
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        item_id: null,
        name: '',
        quantity: '',
        unit: 'pcs',
        price: '',
        is_new_item: true,
        confidence_score: 0,
      },
    ])
  }

  const hasInvalidRows = rows.some((r) => !r.name.trim() || !r.quantity || parseFloat(r.quantity) <= 0)
  const canConfirm = rows.length > 0 && !hasInvalidRows && !isSubmitting

  const totalAmount = rows.reduce((sum, r) => {
    const qty = parseFloat(r.quantity) || 0
    const price = parseFloat(r.price) || 0
    if (!qty || !price) return sum
    const itemTotal = qty * price
    // Sanity cap: skip any single item total above ₹50,000 (likely a parse artefact)
    if (itemTotal > 50_000) return sum
    return sum + itemTotal
  }, 0)

  function handleConfirm() {
    const confirmedItems: ConfirmedItem[] = rows.map((r) => ({
      item_id: r.is_new_item ? null : r.item_id,
      name: r.name.trim(),
      quantity: parseFloat(r.quantity),
      unit: r.unit,
      price_per_unit: r.price ? parseFloat(r.price) : null,
      is_new_item: r.is_new_item,
    }))
    onConfirm(confirmedItems, meta)
  }

  return (
    <section className="flex-[1.5] space-y-6 pb-32">
      {/* Fallback warning */}
      {fallbackUsed && (
        <div className="flex items-start gap-3 bg-tertiary-fixed/30 border border-tertiary-fixed px-4 py-3 rounded-xl">
          <AlertTriangle className="w-4 h-4 text-tertiary mt-0.5 flex-shrink-0" />
          <p className="text-sm text-on-surface/80">
            AI reading unavailable — showing basic scan instead. Please verify all items carefully.
          </p>
        </div>
      )}

      {/* Confirmation table card */}
      <div
        className="bg-surface-container-lowest rounded-xl overflow-hidden"
        style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
      >
        {/* Card header */}
        <div className="px-6 py-4 bg-surface-container-low/50 flex justify-between items-center flex-wrap gap-4">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface/70">
              What we found
            </h3>
            <p className="text-xs text-on-surface/40 mt-0.5">Edit anything before confirming</p>
          </div>
          <div className="flex gap-6 flex-wrap">
            <div className="flex flex-col">
              <label className="text-[10px] text-on-surface/40 uppercase font-bold mb-0.5">
                Supplier
              </label>
              <input
                type="text"
                value={meta.supplier_name}
                onChange={(e) => setMeta((m) => ({ ...m, supplier_name: e.target.value }))}
                placeholder="Supplier name"
                className="bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 text-primary placeholder:text-on-surface/30 outline-none"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-on-surface/40 uppercase font-bold mb-0.5">
                Date
              </label>
              <input
                type="date"
                value={meta.bill_date}
                onChange={(e) => setMeta((m) => ({ ...m, bill_date: e.target.value }))}
                className="bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 outline-none"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-on-surface/40 uppercase font-bold mb-0.5">
                Bill #
              </label>
              <input
                type="text"
                value={meta.bill_number}
                onChange={(e) => setMeta((m) => ({ ...m, bill_number: e.target.value }))}
                placeholder="Optional"
                className="bg-transparent border-none p-0 text-sm focus:ring-0 text-on-surface/60 placeholder:text-on-surface/30 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/30">
                <th className="px-6 py-3 text-[10px] uppercase tracking-wider font-bold text-on-surface/50">
                  Item Name
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-on-surface/50 text-center">
                  Qty
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-on-surface/50 text-center">
                  Unit
                </th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-wider font-bold text-on-surface/50 text-right">
                  Price/unit
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-on-surface/50">
                  Match
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isLowConfidence =
                  !row.is_new_item && row.confidence_score < 0.8 && row.confidence_score > 0
                const hasQtyError =
                  row.quantity !== '' && parseFloat(row.quantity) <= 0
                const isMissingQty = row.quantity === ''

                const rowBg = row.is_new_item
                  ? 'bg-[#EEEEFD]'
                  : isLowConfidence
                  ? 'border-l-2 border-tertiary-fixed'
                  : ''

                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-surface-container-low/20 transition-colors ${rowBg}`}
                  >
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRow(row.id, { name: e.target.value })}
                        className="w-full bg-transparent border-none p-0 text-sm font-medium focus:ring-0 outline-none"
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        value={row.quantity}
                        min={0.001}
                        step="any"
                        onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                        className={[
                          'w-16 bg-transparent border-none p-0 text-sm font-mono text-center focus:ring-0 outline-none',
                          hasQtyError || isMissingQty ? 'ring-1 ring-error rounded' : '',
                        ].join(' ')}
                      />
                    </td>
                    <td className="px-4 py-3 text-center">
                      <select
                        value={row.unit}
                        onChange={(e) => updateRow(row.id, { unit: e.target.value })}
                        className="bg-transparent border-none p-0 text-sm text-center focus:ring-0 outline-none opacity-60 cursor-pointer"
                      >
                        {COMMON_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                        {!COMMON_UNITS.includes(row.unit) && (
                          <option value={row.unit}>{row.unit}</option>
                        )}
                      </select>
                    </td>
                    <td className="px-6 py-3 text-right">
                      <input
                        type="number"
                        value={row.price}
                        min={0}
                        step="any"
                        onChange={(e) => updateRow(row.id, { price: e.target.value })}
                        placeholder="—"
                        className="w-24 bg-transparent border-none p-0 text-sm font-mono font-bold text-right focus:ring-0 outline-none placeholder:text-on-surface/30"
                      />
                    </td>
                    <td className="px-4 py-3">
                      {row.is_new_item ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary-fixed px-2 py-0.5 rounded-full">
                          New item
                        </span>
                      ) : isLowConfidence ? (
                        <span
                          className="text-[10px] font-semibold text-tertiary flex items-center gap-1"
                          title="Low confidence — please verify"
                        >
                          <AlertTriangle className="w-3 h-3" />
                          Verify
                        </span>
                      ) : (
                        <span className="text-[10px] text-on-surface/40">
                          {row.confidence_score === 1 ? '✓ Exact' : '✓ Matched'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="text-on-surface/30 hover:text-error transition-colors"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Add row */}
        <button
          type="button"
          onClick={addEmptyRow}
          className="w-full py-4 text-sm font-semibold text-primary-container hover:bg-surface-container transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-4 h-4" />
          Add item manually
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-secondary-container/20 p-6 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-on-secondary-container/60 mb-1">
            Items Detected
          </p>
          <p className="text-2xl font-black text-on-secondary-container font-mono">
            {String(rows.length).padStart(2, '0')}
          </p>
        </div>
        <div className="bg-surface-container-low p-6 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-on-surface/40 mb-1">
            Total Amount
          </p>
          <p className="text-2xl font-black text-on-surface font-mono">
            {totalAmount > 0 ? `₹${totalAmount.toLocaleString('en-IN')}` : '—'}
          </p>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-[240px] right-0 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/15 px-8 py-5 flex items-center justify-between z-50">
        <p className="text-xs text-on-surface/60 max-w-[260px]">
          Confirming will update stock levels for{' '}
          <strong>{rows.length} item{rows.length !== 1 ? 's' : ''}</strong>
          {meta.supplier_name ? ` from ${meta.supplier_name}` : ''}.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSubmitting}
            className="px-8 py-3.5 text-on-surface/60 font-bold text-sm uppercase tracking-widest hover:text-on-surface transition-colors disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-10 py-3.5 bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold text-sm rounded-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-40 flex items-center gap-3"
          >
            {isSubmitting ? 'Saving…' : 'Confirm & Add to Stock'}
            {!isSubmitting && <ArrowRight className="w-4 h-4" />}
          </button>
        </div>
      </div>
    </section>
  )
}
