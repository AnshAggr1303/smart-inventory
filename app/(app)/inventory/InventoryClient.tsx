'use client'
// Client component: needs useState for modal open/close, search, and filter state

import { useState, useMemo } from 'react'
import Link from 'next/link'
import { Plus, Search, ArrowRight, Edit, Package } from 'lucide-react'
import { formatDistanceToNow } from 'date-fns'
import AddItemModal from '@/app/(app)/inventory/AddItemModal'
import EditItemModal from '@/app/(app)/inventory/EditItemModal'
import { formatQuantity, getStockColor, getStockStatus } from '@/lib/utils/formatQuantity'
import { archiveItemAction } from '@/app/(app)/inventory/actions'
import toast from 'react-hot-toast'
import type { Database } from '@/types/supabase'

type Item = Database['public']['Tables']['items']['Row']

type InventoryClientProps = {
  items: Item[]
  totalCount: number
}

type StatusPillProps = { status: ReturnType<typeof getStockStatus> }
function StatusPill({ status }: StatusPillProps) {
  const styles = {
    in_stock: 'bg-primary-fixed text-primary',
    low: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
    critical: 'bg-error-container text-on-error-container',
    zero: 'bg-error-container text-on-error-container font-bold',
  }
  const labels = { in_stock: 'In Stock', low: 'Low', critical: 'Critical', zero: 'Zero' }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${styles[status]}`}>
      {labels[status]}
    </span>
  )
}

type FilterValue = 'all' | 'in_stock' | 'low' | 'critical' | 'zero'

export default function InventoryClient({ items, totalCount }: InventoryClientProps) {
  const [isAddOpen, setIsAddOpen] = useState(false)
  const [editingItem, setEditingItem] = useState<Item | null>(null)
  const [search, setSearch] = useState('')
  const [filter, setFilter] = useState<FilterValue>('all')
  const [archivingId, setArchivingId] = useState<string | null>(null)

  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      const matchesSearch = item.name.toLowerCase().includes(search.toLowerCase())
      if (!matchesSearch) return false
      if (filter === 'all') return true
      return getStockStatus(Number(item.current_stock), Number(item.reorder_point)) === filter
    })
  }, [items, search, filter])

  async function handleArchive(item: Item) {
    if (!confirm(`Archive "${item.name}"? It will be hidden from all lists.`)) return
    setArchivingId(item.id)
    const result = await archiveItemAction(item.id)
    setArchivingId(null)
    if (result.success) {
      toast.success(`"${item.name}" archived`)
    } else {
      toast.error(result.error)
    }
  }

  const FILTER_OPTIONS: { value: FilterValue; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'in_stock', label: 'In Stock' },
    { value: 'low', label: 'Low' },
    { value: 'critical', label: 'Critical' },
    { value: 'zero', label: 'Zero' },
  ]

  return (
    <>
      {/* Page header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-heading-lg font-semibold text-on-surface">Inventory</h1>
          <p className="text-body-md text-on-surface/60 mt-1">{totalCount} items total</p>
        </div>
        <button
          onClick={() => setIsAddOpen(true)}
          className="flex items-center gap-2 px-5 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold hover:-translate-y-px transition-transform"
        >
          <Plus className="w-4 h-4" />
          Add item
        </button>
      </div>

      {/* Search + filter bar */}
      <div className="flex items-center gap-3 mb-6">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-on-surface-variant" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search items…"
            className="w-full pl-10 pr-4 py-2 bg-surface-lowest rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed"
          />
        </div>
        <div className="flex items-center gap-1 p-1 bg-surface-low rounded-xl">
          {FILTER_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => setFilter(opt.value)}
              className={`px-3 py-1.5 rounded-lg text-body-sm font-medium transition-colors ${
                filter === opt.value
                  ? 'bg-surface-lowest text-primary shadow-sm'
                  : 'text-on-surface-variant hover:text-on-surface'
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* Table or empty state */}
      {filteredItems.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 gap-4">
          <Package className="w-12 h-12 text-outline-variant" />
          <h3 className="text-heading-md font-semibold text-on-surface">
            {search || filter !== 'all' ? 'No matching items' : 'No items yet'}
          </h3>
          <p className="text-body-md text-on-surface/60">
            {search || filter !== 'all'
              ? 'Try a different search or filter.'
              : 'Add your first item or scan a bill to get started.'}
          </p>
          {!search && filter === 'all' && (
            <button
              onClick={() => setIsAddOpen(true)}
              className="flex items-center gap-2 px-5 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold"
            >
              <Plus className="w-4 h-4" />
              Add item
            </button>
          )}
        </div>
      ) : (
        <div className="bg-surface-lowest rounded-2xl overflow-hidden" style={{ boxShadow: '0 12px 32px -4px rgba(27, 28, 22, 0.06)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead className="bg-surface-low">
                <tr>
                  {['Name', 'Category', 'Stock', 'Unit', 'Reorder Point', 'Status', 'Updated', 'Actions'].map((h) => (
                    <th key={h} className="px-5 py-3.5 text-[10px] uppercase tracking-wider font-bold text-on-surface-variant">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filteredItems.map((item) => {
                  const status = getStockStatus(Number(item.current_stock), Number(item.reorder_point))
                  return (
                    <tr key={item.id} className="hover:bg-surface-low/40 transition-colors">
                      <td className="px-5 py-4 font-semibold text-body-md text-on-surface">{item.name}</td>
                      <td className="px-5 py-4 text-body-sm text-on-surface-variant">{item.category ?? '—'}</td>
                      <td className="px-5 py-4">
                        <span className={`font-mono text-body-md ${getStockColor(Number(item.current_stock), Number(item.reorder_point))}`}>
                          {formatQuantity(Number(item.current_stock), item.unit)}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-body-sm text-on-surface-variant">{item.unit}</td>
                      <td className="px-5 py-4 font-mono text-body-md text-on-surface-variant">
                        {formatQuantity(Number(item.reorder_point), item.unit)}
                      </td>
                      <td className="px-5 py-4"><StatusPill status={status} /></td>
                      <td className="px-5 py-4 text-body-sm text-on-surface-variant hidden md:table-cell">
                        {formatDistanceToNow(new Date(item.updated_at ?? ''), { addSuffix: true })}
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingItem(item)}
                            className="p-1.5 rounded-lg hover:bg-surface transition-colors text-on-surface-variant"
                            aria-label="Edit"
                          >
                            <Edit className="w-4 h-4" />
                          </button>
                          <Link
                            href={`/inventory/${item.id}`}
                            className="p-1.5 rounded-lg hover:bg-surface transition-colors text-on-surface-variant"
                            aria-label="View detail"
                          >
                            <ArrowRight className="w-4 h-4" />
                          </Link>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <AddItemModal isOpen={isAddOpen} onClose={() => setIsAddOpen(false)} />
      <EditItemModal item={editingItem} onClose={() => setEditingItem(null)} />
    </>
  )
}
