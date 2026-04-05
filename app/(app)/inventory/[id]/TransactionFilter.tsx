'use client'
// Client component: needs useState for active filter tab

import { useState } from 'react'
import { formatQuantity } from '@/lib/utils/formatQuantity'
import type { Database } from '@/types/supabase'

type Transaction = Database['public']['Tables']['transactions']['Row']
type FilterTab = 'all' | 'additions' | 'deductions' | 'adjustments'

type TransactionFilterProps = {
  transactions: Transaction[]
  runningBalances: Record<string, number>
}

export default function TransactionFilter({ transactions, runningBalances }: TransactionFilterProps) {
  const [activeTab, setActiveTab] = useState<FilterTab>('all')

  const filteredTx = transactions.filter((tx) => {
    if (activeTab === 'additions') return Number(tx.quantity) > 0
    if (activeTab === 'deductions') return Number(tx.quantity) < 0
    if (activeTab === 'adjustments') return tx.type === 'adjustment' || tx.type === 'wastage'
    return true
  })

  const TABS: { value: FilterTab; label: string }[] = [
    { value: 'all', label: 'All' },
    { value: 'additions', label: 'Additions' },
    { value: 'deductions', label: 'Deductions' },
    { value: 'adjustments', label: 'Adjustments' },
  ]

  function getBorderColor(tx: Transaction): string {
    if (Number(tx.quantity) > 0) return 'border-l-primary'
    if (tx.type === 'adjustment' || tx.type === 'wastage') return 'border-l-tertiary-fixed'
    return 'border-l-error'
  }

  function getQtyColor(tx: Transaction): string {
    if (Number(tx.quantity) > 0) return 'text-primary'
    if (tx.type === 'adjustment' || tx.type === 'wastage') return 'text-on-surface-variant'
    return 'text-error'
  }

  function getTypeBadge(tx: Transaction): { label: string; className: string } {
    if (Number(tx.quantity) > 0) {
      return { label: 'Addition', className: 'bg-primary-fixed text-on-primary-fixed' }
    }
    if (tx.type === 'adjustment' || tx.type === 'wastage') {
      return { label: tx.type === 'wastage' ? 'Wastage' : 'Adjustment', className: 'bg-tertiary-fixed text-on-tertiary-fixed' }
    }
    return { label: 'Deduction', className: 'bg-error-container text-on-error-container' }
  }

  return (
    <div>
      {/* Filter tabs */}
      <div className="flex p-1 bg-surface-low rounded-xl gap-0.5 w-fit">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setActiveTab(tab.value)}
            className={`px-4 py-1.5 rounded-lg text-body-sm font-medium transition-colors ${
              activeTab === tab.value
                ? 'bg-surface-lowest text-primary shadow-sm'
                : 'text-on-surface-variant hover:text-on-surface'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Table */}
      {filteredTx.length === 0 ? (
        <p className="py-8 text-center text-body-sm text-on-surface/40">No transactions in this category.</p>
      ) : (
        <div className="overflow-x-auto mt-4">
          <table className="w-full text-left">
            <thead className="bg-surface-low/50">
              <tr>
                {['Date', 'Type', 'Qty', 'Source / Purpose', 'Balance After'].map((h) => (
                  <th key={h} className="px-5 py-3 text-[10px] uppercase tracking-widest font-bold text-on-surface-variant/60">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filteredTx.map((tx) => {
                const badge = getTypeBadge(tx)
                return (
                  <tr
                    key={tx.id}
                    className={`hover:bg-surface-low/30 transition-colors border-l-4 ${getBorderColor(tx)}`}
                  >
                    <td className="px-5 py-4 font-mono text-body-sm text-on-surface">
                      {new Date(tx.created_at ?? '').toLocaleString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        hour: '2-digit',
                        minute: '2-digit',
                      })}
                    </td>
                    <td className="px-5 py-4">
                      <span className={`px-2 py-1 rounded-md text-[10px] font-bold uppercase tracking-tighter ${badge.className}`}>
                        {badge.label}
                      </span>
                    </td>
                    <td className={`px-5 py-4 font-mono font-bold text-body-md ${getQtyColor(tx)}`}>
                      {Number(tx.quantity) > 0 ? '+' : ''}
                      {formatQuantity(Number(tx.quantity), tx.unit)}
                    </td>
                    <td className="px-5 py-4 text-body-md text-on-surface">
                      {tx.note ?? tx.type.replace(/_/g, ' ')}
                    </td>
                    <td className="px-5 py-4 font-mono text-right font-medium text-body-md text-on-surface">
                      {runningBalances[tx.id] != null
                        ? formatQuantity(runningBalances[tx.id] ?? 0, tx.unit)
                        : '—'}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
