import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format, subDays, eachDayOfInterval } from 'date-fns'
import {
  TrendingUp,
  Package,
  AlertTriangle,
  XCircle,
  BookOpen,
  Bot,
} from 'lucide-react'
import { StockMovementChart } from '@/components/analytics/StockMovementChart'
import type { DayData } from '@/components/analytics/StockMovementChart'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ItemRow {
  current_stock: number | null
  cost_per_unit: number | null
  reorder_point: number | null
}

interface TxRow {
  id: string
  type: string
  quantity: number
  unit_multiplier: number
  created_at: string
  recipe_id: string | null
  items: {
    name: string
    unit: string
    cost_per_unit: number | null
  } | null
}

interface RecipeRow {
  id: string
  name: string
}

interface AgentRow {
  status: string
  agent_type: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatINR(val: number | null): string {
  if (val === null || isNaN(val)) return '—'
  return `₹${Math.round(val).toLocaleString('en-IN')}`
}

function formatQty(val: number): string {
  return val.toLocaleString('en-IN', { maximumFractionDigits: 2 })
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AnalyticsPage() {
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

  const thirtyDaysAgo = subDays(new Date(), 30).toISOString()

  // ── Parallel fetches ──────────────────────────────────────────────────────

  const [
    { data: rawItems },
    { data: rawTransactions },
    { data: rawRecipes },
    { data: rawAgentActions },
  ] = await Promise.all([
    // A: all active items for stock value summary
    supabase
      .from('items')
      .select('current_stock, cost_per_unit, reorder_point')
      .eq('org_id', org_id)
      .eq('is_archived', false),

    // B/C/D/E: all transactions last 30 days with item cost
    supabase
      .from('transactions')
      .select('id, type, quantity, unit_multiplier, created_at, recipe_id, items(name, unit, cost_per_unit)')
      .eq('org_id', org_id)
      .gte('created_at', thirtyDaysAgo)
      .order('created_at', { ascending: true }),

    // E: recipes for name lookup
    supabase
      .from('recipes')
      .select('id, name')
      .eq('org_id', org_id)
      .eq('is_archived', false),

    // F: agent actions last 30 days
    supabase
      .from('agent_actions')
      .select('status, agent_type')
      .eq('org_id', org_id)
      .gte('created_at', thirtyDaysAgo),
  ])

  const items = (rawItems ?? []) as ItemRow[]
  const transactions = (rawTransactions ?? []) as TxRow[]
  const recipes = (rawRecipes ?? []) as RecipeRow[]
  const agentActions = (rawAgentActions ?? []) as AgentRow[]

  // ── A: Stock value summary ────────────────────────────────────────────────

  const totalStockValue = items.reduce((acc, item) => {
    const stock = Number(item.current_stock ?? 0)
    const cost = Number(item.cost_per_unit ?? 0)
    return acc + stock * cost
  }, 0)

  const lowStockCount = items.filter(
    (i) =>
      Number(i.reorder_point ?? 0) > 0 &&
      Number(i.current_stock ?? 0) <= Number(i.reorder_point ?? 0)
  ).length

  const outOfStockCount = items.filter(
    (i) => Number(i.current_stock ?? 0) === 0
  ).length

  // ── B: Top consumed items (deductions, last 30 days) ─────────────────────

  const deductionTx = transactions.filter(
    (t) => t.type === 'recipe_deduction' || t.type === 'manual_deduction'
  )

  const consumptionMap = new Map<
    string,
    { unit: string; totalConsumed: number; costPerUnit: number | null }
  >()

  for (const tx of deductionTx) {
    const name = tx.items?.name ?? 'Unknown'
    const consumed = Math.abs(Number(tx.quantity) * Number(tx.unit_multiplier))
    const existing = consumptionMap.get(name)
    if (existing) {
      existing.totalConsumed += consumed
    } else {
      consumptionMap.set(name, {
        unit: tx.items?.unit ?? '',
        totalConsumed: consumed,
        costPerUnit: tx.items?.cost_per_unit ?? null,
      })
    }
  }

  const topConsumedItems = Array.from(consumptionMap.entries())
    .map(([name, data]) => ({
      name,
      unit: data.unit,
      totalConsumed: data.totalConsumed,
      consumptionValue:
        data.costPerUnit !== null
          ? data.totalConsumed * data.costPerUnit
          : null,
    }))
    .sort((a, b) => (b.consumptionValue ?? 0) - (a.consumptionValue ?? 0))
    .slice(0, 10)

  // ── D: Daily transaction volume last 14 days ─────────────────────────────

  const fourteenDaysAgoDate = subDays(new Date(), 13)
  const days = eachDayOfInterval({ start: fourteenDaysAgoDate, end: new Date() })

  const dailyData: DayData[] = days.map((day) => {
    const dayKey = format(day, 'yyyy-MM-dd')
    const dayTx = transactions.filter(
      (t) => format(new Date(t.created_at), 'yyyy-MM-dd') === dayKey
    )

    const additions = dayTx
      .filter((t) => Number(t.quantity) > 0)
      .reduce((acc, t) => {
        return (
          acc +
          Number(t.quantity) *
            Number(t.unit_multiplier) *
            Number(t.items?.cost_per_unit ?? 0)
        )
      }, 0)

    const deductions = dayTx
      .filter((t) => Number(t.quantity) < 0)
      .reduce((acc, t) => {
        return (
          acc +
          Math.abs(Number(t.quantity) * Number(t.unit_multiplier)) *
            Number(t.items?.cost_per_unit ?? 0)
        )
      }, 0)

    return {
      day: format(day, 'dd MMM'),
      additions,
      deductions,
    }
  })

  // ── E: Top recipes by usage (last 30 days) ───────────────────────────────

  const recipeMap = new Map(recipes.map((r) => [r.id, r.name]))

  const recipeUsageMap = new Map<
    string,
    { name: string; timesUsed: number }
  >()

  for (const tx of transactions.filter(
    (t) => t.type === 'recipe_deduction' && t.recipe_id !== null
  )) {
    const rid = tx.recipe_id as string
    const name = recipeMap.get(rid) ?? 'Unknown Recipe'
    const existing = recipeUsageMap.get(rid)
    if (existing) {
      existing.timesUsed += 1
    } else {
      recipeUsageMap.set(rid, { name, timesUsed: 1 })
    }
  }

  const topRecipes = Array.from(recipeUsageMap.values())
    .sort((a, b) => b.timesUsed - a.timesUsed)
    .slice(0, 5)

  // ── F: Agent actions summary (last 30 days) ──────────────────────────────

  const agentTotal = agentActions.length
  const agentApproved = agentActions.filter(
    (a) => a.status === 'approved' || a.status === 'executed'
  ).length
  const agentDismissed = agentActions.filter(
    (a) => a.status === 'rejected'
  ).length

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-7xl mx-auto space-y-8">
      {/* Page header */}
      <div>
        <h1 className="text-heading-md font-semibold text-on-surface">
          Analytics
        </h1>
        <p className="text-body-md text-on-surface-variant mt-1">
          Stock health and financial insights — last 30 days.
        </p>
      </div>

      {/* ── Section 1: KPI cards ─────────────────────────────────────────── */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {[
          {
            label: 'Total Stock Value',
            value: formatINR(totalStockValue),
            sub: 'at current cost',
            icon: <TrendingUp className="w-5 h-5" />,
            iconBg: 'bg-primary-fixed text-primary',
          },
          {
            label: 'Items Tracked',
            value: items.length,
            sub: 'active items',
            icon: <Package className="w-5 h-5" />,
            iconBg: 'bg-secondary-fixed text-primary',
          },
          {
            label: 'Low Stock Items',
            value: lowStockCount,
            sub: 'below reorder point',
            icon: <AlertTriangle className="w-5 h-5" />,
            iconBg: 'bg-tertiary-fixed text-tertiary',
          },
          {
            label: 'Out of Stock',
            value: outOfStockCount,
            sub: 'zero quantity',
            icon: <XCircle className="w-5 h-5" />,
            iconBg: 'bg-error-container text-on-error-container',
          },
        ].map((card) => (
          <div
            key={card.label}
            className="bg-surface-lowest rounded-card-lg p-6"
            style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${card.iconBg}`}>{card.icon}</div>
            </div>
            <div className="font-mono text-3xl font-bold text-on-surface">
              {card.value}
            </div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mt-1">
              {card.label}
            </div>
            <div className="text-body-sm text-on-surface/40 mt-0.5">
              {card.sub}
            </div>
          </div>
        ))}
      </section>

      {/* ── Section 2: Stock movement chart ──────────────────────────────── */}
      <section
        className="bg-surface-lowest rounded-2xl p-6"
        style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
      >
        <div className="flex items-start justify-between mb-6">
          <div>
            <h2 className="text-body-md font-medium text-on-surface">
              Stock movement — last 14 days
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Value of additions and deductions per day
            </p>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: '#10B981' }}
              />
              <span className="text-body-sm text-on-surface-variant">
                Additions
              </span>
            </div>
            <div className="flex items-center gap-1.5">
              <span
                className="w-2.5 h-2.5 rounded-sm"
                style={{ background: '#3D3BF3' }}
              />
              <span className="text-body-sm text-on-surface-variant">
                Deductions
              </span>
            </div>
          </div>
        </div>
        <StockMovementChart data={dailyData} />
      </section>

      {/* ── Section 3: Two-column layout ─────────────────────────────────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">

        {/* Left: Top consumed items */}
        <div
          className="bg-surface-lowest rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
        >
          <div className="px-6 pt-6 pb-4">
            <h2 className="text-body-md font-medium text-on-surface">
              Top consumed items
            </h2>
            <p className="text-body-sm text-on-surface-variant mt-0.5">
              Last 30 days, by deduction value
            </p>
          </div>
          {topConsumedItems.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
              <Package className="w-12 h-12 text-outline-variant mb-3" />
              <p className="text-body-md font-medium text-on-surface">
                No consumption recorded
              </p>
              <p className="text-body-sm text-on-surface-variant mt-1">
                Deductions will appear here after recipe or manual usage
              </p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="bg-surface-low">
                  <th className="px-6 py-3 text-left text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant">
                    Item
                  </th>
                  <th className="px-6 py-3 text-right text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant">
                    Consumed
                  </th>
                  <th className="px-6 py-3 text-right text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant">
                    Value
                  </th>
                </tr>
              </thead>
              <tbody>
                {topConsumedItems.map((item, idx) => (
                  <tr
                    key={idx}
                    className="border-t border-outline-variant/10 hover:bg-surface-low/40 transition-colors"
                  >
                    <td className="px-6 py-3 text-body-md font-medium text-on-surface">
                      {item.name}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-body-md text-on-surface">
                      {formatQty(item.totalConsumed)}&nbsp;{item.unit}
                    </td>
                    <td className="px-6 py-3 text-right font-mono text-body-md text-on-surface">
                      {item.consumptionValue !== null
                        ? formatINR(item.consumptionValue)
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* Right: Top recipes by usage */}
        <div
          className="bg-surface-lowest rounded-2xl p-6"
          style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
        >
          <h2 className="text-body-md font-medium text-on-surface">
            Top recipes by usage
          </h2>
          <p className="text-body-sm text-on-surface-variant mt-0.5 mb-6">
            Last 30 days
          </p>
          {topRecipes.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-10 text-center">
              <BookOpen className="w-12 h-12 text-outline-variant mb-3" />
              <p className="text-body-md font-medium text-on-surface">
                No recipe usage yet
              </p>
              <p className="text-body-sm text-on-surface-variant mt-1">
                Use recipes to deduct ingredients and track usage here
              </p>
            </div>
          ) : (
            <div className="space-y-1">
              {topRecipes.map((recipe, idx) => (
                <div
                  key={idx}
                  className="flex items-center justify-between py-3 border-b border-outline-variant/10 last:border-0"
                >
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-body-sm text-on-surface-variant w-5 text-right">
                      {idx + 1}
                    </span>
                    <span className="text-body-md font-medium text-on-surface">
                      {recipe.name}
                    </span>
                  </div>
                  <span className="px-3 py-1 bg-secondary-container/20 text-on-secondary-container rounded-full text-body-sm font-semibold font-mono">
                    {recipe.timesUsed}×
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Section 4: Agent activity summary ────────────────────────────── */}
      <section
        className="bg-surface-lowest rounded-2xl p-6"
        style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
      >
        <div className="flex items-center gap-2 mb-4">
          <Bot className="w-4 h-4 text-on-surface-variant" />
          <h2 className="text-body-md font-medium text-on-surface">
            Agent activity
          </h2>
          <span className="text-body-sm text-on-surface-variant ml-1">
            — last 30 days
          </span>
        </div>
        <div className="flex items-center gap-8 flex-wrap">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-primary" />
            <span className="text-body-md text-on-surface">
              <span className="font-mono font-bold">{agentTotal}</span>
              <span className="text-on-surface-variant ml-1.5">proposed</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full" style={{ background: '#10B981' }} />
            <span className="text-body-md text-on-surface">
              <span className="font-mono font-bold">{agentApproved}</span>
              <span className="text-on-surface-variant ml-1.5">approved</span>
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-error" />
            <span className="text-body-md text-on-surface">
              <span className="font-mono font-bold">{agentDismissed}</span>
              <span className="text-on-surface-variant ml-1.5">dismissed</span>
            </span>
          </div>
        </div>
      </section>
    </div>
  )
}
