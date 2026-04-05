import Link from 'next/link'
import { Package, AlertTriangle, FileText, Cpu } from 'lucide-react'
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { formatQuantity } from '@/lib/utils/formatQuantity'
import LiveStockTable from '@/components/dashboard/LiveStockTable'
import { formatDistanceToNow } from 'date-fns'
import type { Database } from '@/types/supabase'

type Transaction = Database['public']['Tables']['transactions']['Row'] & {
  items: { name: string; unit: string } | null
}

type AgentAction = Database['public']['Tables']['agent_actions']['Row']

const AGENT_COLORS: Record<string, string> = {
  reorder: 'bg-primary',
  shrinkage: 'bg-tertiary',
  demand_forecast: 'bg-[#7C3AED]',
}

export default async function DashboardPage() {
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

  // Fetch all active items
  const { data: allItems } = await supabase
    .from('items')
    .select('*')
    .eq('org_id', org_id)
    .eq('is_archived', false)
    .order('current_stock', { ascending: true })

  const items = allItems ?? []
  const totalItems = items.length
  const lowStockItems = items.filter(
    (i) => Number(i.reorder_point) > 0 && Number(i.current_stock) <= Number(i.reorder_point)
  )
  const dashboardItems = items.slice(0, 10)

  // Bills scanned today
  const todayStart = new Date()
  todayStart.setHours(0, 0, 0, 0)
  const { count: billsToday } = await supabase
    .from('bills')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org_id)
    .gte('created_at', todayStart.toISOString())

  // Pending agent actions
  const { count: pendingAgentCount } = await supabase
    .from('agent_actions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org_id)
    .eq('status', 'pending')

  // Recent transactions with item name
  const { data: recentTransactions } = await supabase
    .from('transactions')
    .select('*, items(name, unit)')
    .eq('org_id', org_id)
    .order('created_at', { ascending: false })
    .limit(5)

  // Recent agent actions
  const { data: recentAgentActions } = await supabase
    .from('agent_actions')
    .select('*')
    .eq('org_id', org_id)
    .order('triggered_at', { ascending: false })
    .limit(3)

  const statCards = [
    { label: 'Total Items', value: totalItems, icon: <Package className="w-5 h-5" />, iconBg: 'bg-primary-fixed text-primary' },
    { label: 'Low Stock Alerts', value: lowStockItems.length, icon: <AlertTriangle className="w-5 h-5" />, iconBg: 'bg-tertiary-fixed text-tertiary' },
    { label: 'Bills Scanned Today', value: billsToday ?? 0, icon: <FileText className="w-5 h-5" />, iconBg: 'bg-secondary-fixed text-primary' },
    { label: 'Agent Actions Pending', value: pendingAgentCount ?? 0, icon: <Cpu className="w-5 h-5" />, iconBg: 'bg-[#EDE9FE] text-[#7C3AED]' },
  ]

  return (
    <div className="max-w-7xl mx-auto space-y-8">

      {/* Stats row */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
        {statCards.map((card) => (
          <div
            key={card.label}
            className="bg-surface-lowest rounded-card-lg p-6"
            style={{ boxShadow: '0 12px 32px -4px rgba(27, 28, 22, 0.06)' }}
          >
            <div className="flex justify-between items-start mb-4">
              <div className={`p-2 rounded-lg ${card.iconBg}`}>{card.icon}</div>
            </div>
            <div className="font-mono text-3xl font-bold text-on-surface">{card.value}</div>
            <div className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mt-1">
              {card.label}
            </div>
          </div>
        ))}
      </div>

      {/* Alerts panel */}
      {lowStockItems.length > 0 && (
        <section className="bg-tertiary-fixed/20 border-l-4 border-tertiary rounded-xl p-5">
          <div className="flex items-center gap-2 mb-4">
            <AlertTriangle className="w-5 h-5 text-tertiary" />
            <h2 className="text-body-md font-bold text-on-surface">Needs your attention</h2>
          </div>
          <div className="space-y-3">
            {lowStockItems.slice(0, 5).map((item) => (
              <div
                key={item.id}
                className="flex items-center justify-between bg-surface-lowest/60 px-4 py-3 rounded-lg"
              >
                <div className="flex items-center gap-4">
                  <span className="font-medium text-body-md text-on-surface">{item.name}</span>
                  <span className="text-body-sm text-tertiary font-medium">
                    Only {formatQuantity(Number(item.current_stock), item.unit)} left
                  </span>
                  <Link href="/agents" className="text-primary text-body-sm font-bold hover:underline">
                    Reorder agent ready →
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Live stock table */}
      <section className="bg-surface-lowest rounded-2xl overflow-hidden" style={{ boxShadow: '0 12px 32px -4px rgba(27, 28, 22, 0.06)' }}>
        <div className="px-6 py-4 flex items-center justify-between">
          <h2 className="text-heading-md font-semibold text-on-surface">Live Stock</h2>
          <Link href="/inventory" className="text-body-sm text-primary font-semibold hover:underline">
            View all →
          </Link>
        </div>
        <LiveStockTable initialItems={dashboardItems} orgId={org_id} />
      </section>

      {/* Bottom row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Recent transactions */}
        <div className="bg-surface-lowest rounded-2xl p-6" style={{ boxShadow: '0 12px 32px -4px rgba(27, 28, 22, 0.06)' }}>
          <h3 className="text-body-md font-bold text-on-surface mb-5">Recent stock movements</h3>
          {(!recentTransactions || recentTransactions.length === 0) ? (
            <p className="text-body-sm text-on-surface/50 py-6 text-center">No transactions yet.</p>
          ) : (
            <div className="space-y-3">
              {(recentTransactions as Transaction[]).map((tx) => {
                const isAddition = tx.quantity > 0
                return (
                  <div key={tx.id} className="flex items-center justify-between py-3">
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center text-body-sm font-bold ${
                          isAddition ? 'bg-primary-fixed text-primary' : 'bg-error-container text-on-error-container'
                        }`}
                      >
                        {isAddition ? '+' : '−'}
                      </div>
                      <div>
                        <p className="text-body-md font-semibold text-on-surface">{tx.items?.name ?? '—'}</p>
                        <p className="text-[10px] uppercase tracking-wider text-on-surface-variant font-medium">
                          {tx.type.replace(/_/g, ' ')}
                        </p>
                      </div>
                    </div>
                    <span className={`font-mono text-body-md font-bold ${isAddition ? 'text-primary' : 'text-error'}`}>
                      {isAddition ? '+' : ''}
                      {formatQuantity(Number(tx.quantity), tx.unit)}
                    </span>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        {/* Agent activity */}
        <div className="bg-surface-lowest rounded-2xl p-6" style={{ boxShadow: '0 12px 32px -4px rgba(27, 28, 22, 0.06)' }}>
          <div className="flex items-center justify-between mb-5">
            <h3 className="text-body-md font-bold text-on-surface">AI Agents</h3>
            {(pendingAgentCount ?? 0) > 0 && (
              <span className="px-2 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed-variant rounded-full text-[10px] font-bold uppercase tracking-wider">
                {pendingAgentCount} pending
              </span>
            )}
          </div>
          {(!recentAgentActions || recentAgentActions.length === 0) ? (
            <p className="text-body-sm text-on-surface/50 py-6 text-center">No agent activity yet.</p>
          ) : (
            <div className="space-y-3">
              {(recentAgentActions as AgentAction[]).map((action) => (
                <div key={action.id} className="flex items-start gap-3 py-3">
                  <div
                    className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${AGENT_COLORS[action.agent_type] ?? 'bg-on-surface-variant'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-body-md font-semibold text-on-surface truncate">{action.title}</p>
                    <p className="text-body-sm text-on-surface-variant">
                      {formatDistanceToNow(new Date(action.triggered_at ?? ''), { addSuffix: true })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span
                      className={`px-2 py-0.5 rounded-full text-[10px] uppercase tracking-wider font-bold ${
                        action.status === 'pending'
                          ? 'bg-secondary-container text-on-secondary-container'
                          : action.status === 'approved' || action.status === 'executed'
                          ? 'bg-primary-fixed text-primary'
                          : 'bg-error-container text-on-error-container'
                      }`}
                    >
                      {action.status}
                    </span>
                    {action.status === 'pending' && (
                      <Link href="/agents" className="text-primary text-body-sm font-bold hover:underline">
                        Review →
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
