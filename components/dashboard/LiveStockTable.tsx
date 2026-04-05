'use client'
// Client component: uses Supabase Realtime for live stock UPDATE events

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Edit } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { formatQuantity, getStockColor, getStockStatus } from '@/lib/utils/formatQuantity'
import type { Database } from '@/types/supabase'
import { formatDistanceToNow } from 'date-fns'

type Item = Database['public']['Tables']['items']['Row']

type LiveStockTableProps = {
  initialItems: Item[]
  orgId: string
}

type StatusPillProps = { status: ReturnType<typeof getStockStatus> }
function StatusPill({ status }: StatusPillProps) {
  const map = {
    in_stock: 'bg-primary-fixed text-primary',
    low: 'bg-tertiary-fixed text-on-tertiary-fixed-variant',
    critical: 'bg-error-container text-on-error-container',
    zero: 'bg-error-container text-on-error-container font-bold',
  }
  const labels = { in_stock: 'In Stock', low: 'Low', critical: 'Critical', zero: 'Zero' }
  return (
    <span className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${map[status]}`}>
      {labels[status]}
    </span>
  )
}

export default function LiveStockTable({ initialItems, orgId }: LiveStockTableProps) {
  const [items, setItems] = useState<Item[]>(initialItems)

  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('live-stock-updates')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'items', filter: `org_id=eq.${orgId}` },
        (payload) => {
          setItems((prev) =>
            prev.map((item) => (item.id === payload.new.id ? (payload.new as Item) : item))
          )
        }
      )
      .subscribe()
    return () => { void supabase.removeChannel(channel) }
  }, [orgId])

  if (items.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-body-md text-on-surface/50">
        No items yet. Scan a bill or add items to see them here.
      </div>
    )
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-left">
        <thead className="bg-surface-low">
          <tr>
            {['Item', 'Category', 'Stock', 'Unit', 'Reorder Point', 'Status', 'Last Updated', ''].map((h) => (
              <th
                key={h}
                className="px-6 py-4 text-[10px] uppercase tracking-wider font-bold text-on-surface-variant"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const status = getStockStatus(Number(item.current_stock), Number(item.reorder_point))
            return (
              <tr
                key={item.id}
                className="hover:bg-surface-low/50 transition-colors"
              >
                <td className="px-6 py-4 font-semibold text-body-md text-on-surface">
                  <Link href={`/app/inventory/${item.id}`} className="hover:text-primary transition-colors">
                    {item.name}
                  </Link>
                </td>
                <td className="px-6 py-4 text-body-sm text-on-surface-variant">{item.category ?? '—'}</td>
                <td className="px-6 py-4">
                  <span className={`font-mono text-body-md ${getStockColor(Number(item.current_stock), Number(item.reorder_point))}`}>
                    {formatQuantity(Number(item.current_stock), item.unit)}
                  </span>
                </td>
                <td className="px-6 py-4 text-body-sm text-on-surface-variant">{item.unit}</td>
                <td className="px-6 py-4 font-mono text-body-md text-on-surface-variant">
                  {formatQuantity(Number(item.reorder_point), item.unit)}
                </td>
                <td className="px-6 py-4">
                  <StatusPill status={status} />
                </td>
                <td className="px-6 py-4 text-body-sm text-on-surface-variant">
                  {formatDistanceToNow(new Date(item.updated_at ?? ''), { addSuffix: true })}
                </td>
                <td className="px-6 py-4 text-right">
                  <Link
                    href={`/app/inventory/${item.id}`}
                    className="p-1.5 rounded-lg hover:bg-surface transition-colors text-on-surface-variant inline-flex"
                  >
                    <Edit className="w-4 h-4" />
                  </Link>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
