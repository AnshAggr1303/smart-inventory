import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Calendar, AlertTriangle } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { formatQuantity, getStockStatus } from '@/lib/utils/formatQuantity'
import StockChart from '@/app/(app)/inventory/[id]/StockChart'
import TransactionFilter from '@/app/(app)/inventory/[id]/TransactionFilter'
import type { Database } from '@/types/supabase'

type Transaction = Database['public']['Tables']['transactions']['Row']

type PageProps = {
  params: Promise<{ id: string }>
}

function computeRunningBalances(
  transactions: Transaction[],
  currentStock: number
): Record<string, number> {
  const sorted = [...transactions].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  )
  const sumAll = sorted.reduce((s, t) => s + Number(t.quantity) * Number(t.unit_multiplier), 0)
  let balance = currentStock - sumAll
  const result: Record<string, number> = {}
  for (const tx of sorted) {
    balance += Number(tx.quantity) * Number(tx.unit_multiplier)
    result[tx.id] = Math.max(0, parseFloat(balance.toFixed(4)))
  }
  return result
}

export default async function ItemDetailPage({ params }: PageProps) {
  const { id } = await params

  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (!profile?.org_id) redirect('/onboarding/step-2')
  const org_id = profile.org_id

  // Fetch item (org_id scoping enforced by RLS + explicit eq)
  const { data: item } = await supabase
    .from('items')
    .select('*')
    .eq('id', id)
    .eq('org_id', org_id)
    .eq('is_archived', false)
    .single()
  if (!item) notFound()

  // Fetch last 30 transactions
  const { data: transactions } = await supabase
    .from('transactions')
    .select('*')
    .eq('item_id', id)
    .eq('org_id', org_id)
    .order('created_at', { ascending: false })
    .limit(30)

  const txList = transactions ?? []

  // Compute avg daily usage from last 30 days
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
  const recentDeductions = txList.filter(
    (t) => Number(t.quantity) < 0 && new Date(t.created_at) >= thirtyDaysAgo
  )
  const totalUsed = recentDeductions.reduce(
    (sum, t) => sum + Math.abs(Number(t.quantity) * Number(t.unit_multiplier)),
    0
  )
  const avgDailyUsage = totalUsed / 30

  // Fetch supplier if set
  let supplierName: string | null = null
  if (item.preferred_supplier_id) {
    const { data: supplier } = await supabase
      .from('suppliers')
      .select('name')
      .eq('id', item.preferred_supplier_id)
      .single()
    supplierName = supplier?.name ?? null
  }

  // Fetch recipes that use this item
  const { data: recipeRows } = await supabase
    .from('recipe_ingredients')
    .select('recipes(name)')
    .eq('item_id', id)
    .eq('org_id', org_id)

  const usedInRecipes = recipeRows?.map((r) => (r.recipes as { name: string } | null)?.name).filter(Boolean) ?? []

  // Last restocked date
  const lastRestock = txList.find((t) => Number(t.quantity) > 0)
  const totalValue =
    item.cost_per_unit != null ? Number(item.current_stock) * Number(item.cost_per_unit) : null

  const runningBalances = computeRunningBalances(txList, Number(item.current_stock))
  const status = getStockStatus(Number(item.current_stock), Number(item.reorder_point))

  const STATUS_MAP = {
    in_stock: { label: 'In Stock', className: 'bg-primary-fixed text-primary' },
    low: { label: 'Low Stock', className: 'bg-tertiary-fixed text-on-tertiary-fixed-variant' },
    critical: { label: 'Critical', className: 'bg-error-container text-on-error-container' },
    zero: { label: 'Out of Stock', className: 'bg-error-container text-on-error-container font-bold' },
  }

  return (
    <div className="max-w-7xl mx-auto space-y-6">

      {/* Back + header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link
            href="/app/inventory"
            className="w-10 h-10 flex items-center justify-center rounded-full hover:bg-surface-low transition-colors text-on-surface-variant"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div className="flex items-baseline gap-3 flex-wrap">
            <h1 className="text-heading-lg font-semibold text-on-surface">{item.name}</h1>
            {item.category && (
              <span className="px-3 py-1 rounded-full text-[10px] uppercase tracking-wider font-semibold bg-surface-low text-on-surface-variant">
                {item.category}
              </span>
            )}
            <span className={`px-3 py-1 rounded-full text-body-sm font-bold flex items-center gap-1 ${STATUS_MAP[status].className}`}>
              {status === 'low' || status === 'critical' ? <AlertTriangle className="w-3.5 h-3.5" /> : null}
              {STATUS_MAP[status].label}
            </span>
          </div>
        </div>
      </div>

      {/* Metric cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        <div className="bg-surface-lowest rounded-xl p-6" style={{ boxShadow: '0 12px 32px -4px rgba(27, 28, 22, 0.06)' }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/70 mb-2">Current Stock</p>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold text-primary">{Number(item.current_stock).toFixed(2).replace(/\.?0+$/, '')}</span>
            <span className="text-on-surface-variant font-medium">{item.unit}</span>
          </div>
        </div>
        <div className="bg-surface-lowest rounded-xl p-6" style={{ outline: '1px solid rgba(198, 196, 217, 0.15)' }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/70 mb-2">Reorder Point</p>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold text-on-surface-variant/40">{Number(item.reorder_point)}</span>
            <span className="text-on-surface-variant/40 font-medium">{item.unit}</span>
          </div>
          <p className="mt-3 text-body-sm text-on-surface-variant/60">Alert enabled when stock drops below this</p>
        </div>
        <div className="bg-surface-lowest rounded-xl p-6" style={{ outline: '1px solid rgba(198, 196, 217, 0.15)' }}>
          <p className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant/70 mb-2">Avg Daily Use</p>
          <div className="flex items-baseline gap-2">
            <span className="font-mono text-4xl font-bold text-on-surface-variant/40">{avgDailyUsage.toFixed(1)}</span>
            <span className="text-on-surface-variant/40 font-medium">{item.unit}/day</span>
          </div>
          <p className="mt-3 text-body-sm text-on-surface-variant/60 italic">Based on last 30 days</p>
        </div>
      </div>

      {/* Details grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        <div className="bg-surface-low rounded-xl p-7">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-5">Specifications</h3>
          <div className="grid grid-cols-2 gap-y-5">
            <div>
              <p className="text-body-sm text-on-surface-variant/60 mb-1">Standard Unit</p>
              <p className="font-medium text-on-surface">{item.unit}</p>
            </div>
            <div>
              <p className="text-body-sm text-on-surface-variant/60 mb-1">Category</p>
              <p className="font-medium text-primary">{item.category ?? '—'}</p>
            </div>
            <div>
              <p className="text-body-sm text-on-surface-variant/60 mb-1">Supplier</p>
              <p className="font-medium text-on-surface">{supplierName ?? '—'}</p>
            </div>
            <div>
              <p className="text-body-sm text-on-surface-variant/60 mb-1">Last Restocked</p>
              <p className="font-mono font-medium text-body-md text-on-surface">
                {lastRestock
                  ? new Date(lastRestock.created_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
                  : '—'}
              </p>
            </div>
            {item.track_expiry && item.earliest_expiry && (
              <div className="col-span-2">
                <p className="text-body-sm text-on-surface-variant/60 mb-1">Expiry Date</p>
                <p className="font-medium text-error flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(item.earliest_expiry).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </p>
              </div>
            )}
          </div>
        </div>

        <div className="bg-surface-low rounded-xl p-7">
          <h3 className="text-[10px] uppercase tracking-widest font-bold text-on-surface-variant mb-5">Financials &amp; Usage</h3>
          <div className="space-y-4">
            <div className="flex justify-between items-center py-2">
              <span className="text-body-sm text-on-surface-variant/70">Cost per unit</span>
              <span className="font-mono font-bold text-on-surface">
                {item.cost_per_unit != null ? `₹ ${Number(item.cost_per_unit).toFixed(2)} / ${item.unit}` : '—'}
              </span>
            </div>
            <div className="flex justify-between items-center py-2">
              <span className="text-body-sm text-on-surface-variant/70">Total value in stock</span>
              <span className="font-mono font-bold text-primary">
                {totalValue != null ? `₹ ${totalValue.toFixed(2)}` : '—'}
              </span>
            </div>
            {usedInRecipes.length > 0 && (
              <div className="py-2">
                <span className="text-body-sm text-on-surface-variant/70 block mb-2">Used in recipes</span>
                <div className="flex flex-wrap gap-2">
                  {usedInRecipes.map((name) => (
                    <span
                      key={name}
                      className="bg-surface-lowest px-3 py-1.5 rounded-lg text-body-sm font-medium text-on-surface"
                      style={{ outline: '1px solid rgba(198, 196, 217, 0.15)' }}
                    >
                      {name}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Stock history chart */}
      <div className="bg-surface-lowest rounded-xl p-7" style={{ outline: '1px solid rgba(198, 196, 217, 0.15)' }}>
        <div className="flex justify-between items-start mb-6">
          <div>
            <h3 className="font-bold text-body-md text-on-surface">Stock Level History</h3>
            <p className="text-body-sm text-on-surface-variant/60 mt-1">Last 30 transactions trend</p>
          </div>
          <div className="flex gap-4">
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-primary" />
              <span className="text-body-sm font-medium text-on-surface">Actual Stock</span>
            </div>
            {Number(item.reorder_point) > 0 && (
              <div className="flex items-center gap-2">
                <span className="w-4 border-t-2 border-dashed border-error" />
                <span className="text-body-sm font-medium text-on-surface">Reorder Point</span>
              </div>
            )}
          </div>
        </div>
        <StockChart
          transactions={txList}
          currentStock={Number(item.current_stock)}
          reorderPoint={Number(item.reorder_point)}
          unit={item.unit}
        />
      </div>

      {/* Transaction history */}
      <div className="bg-surface-lowest rounded-xl overflow-hidden" style={{ outline: '1px solid rgba(198, 196, 217, 0.15)' }}>
        <div className="px-6 py-5 flex justify-between items-center">
          <h3 className="font-bold text-body-md text-on-surface">All movements</h3>
        </div>
        <div className="px-6 pb-6">
          <TransactionFilter transactions={txList} runningBalances={runningBalances} />
        </div>
      </div>
    </div>
  )
}
