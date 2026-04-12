'use client'
// Client component: tab state for Pending / Activity Log / Settings

import { useState } from 'react'
import { Bot, History } from 'lucide-react'
import { ActionCard } from './ActionCard'
import { AgentSettings } from './AgentSettings'

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentAction = {
  id: string
  agent_type: string
  title: string
  description: string | null
  payload: Record<string, unknown> | null
  triggered_at: string | null
  status: string | null
}

type AgentConfig = {
  reorder_enabled: boolean
  shrinkage_enabled: boolean
  forecast_enabled: boolean
  shrinkage_threshold_pct: number
  forecast_horizon_days: number
  reorder_lead_time_days: number
}

type Props = {
  pending: AgentAction[]
  history: AgentAction[]
  agentConfig: AgentConfig
}

type Tab = 'pending' | 'activity' | 'settings'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(iso: string | null): string {
  if (!iso) return ''
  const diffMs = Date.now() - new Date(iso).getTime()
  const diffMins = Math.floor(diffMs / 60000)
  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  const diffHrs = Math.floor(diffMins / 60)
  if (diffHrs < 24) return `${diffHrs}h ago`
  const diffDays = Math.floor(diffHrs / 24)
  if (diffDays === 1) return 'Yesterday'
  return `${diffDays}d ago`
}

const STATUS_PILL: Record<string, string> = {
  pending: 'bg-tertiary-fixed text-on-tertiary-fixed',
  approved: 'bg-green-100 text-green-700',
  executed: 'bg-green-100 text-green-700',
  rejected: 'bg-surface-container text-on-surface-variant',
  failed: 'bg-error/10 text-error',
}

const STATUS_DOT: Record<string, string> = {
  pending: 'bg-[#825100]',
  approved: 'bg-green-500',
  executed: 'bg-primary',
  rejected: 'bg-outline-variant',
  failed: 'bg-error',
}

const AGENT_LABELS: Record<string, string> = {
  reorder: 'Reorder',
  shrinkage: 'Shrinkage',
  demand_forecast: 'Forecast',
}

// ─── Activity log filter options ──────────────────────────────────────────────

const AGENT_FILTER_OPTIONS = [
  { value: '', label: 'All Agents' },
  { value: 'reorder', label: 'Reorder' },
  { value: 'shrinkage', label: 'Shrinkage' },
  { value: 'demand_forecast', label: 'Forecast' },
]

// ─── Client component ─────────────────────────────────────────────────────────

export function AgentsClient({ pending: initialPending, history, agentConfig }: Props) {
  const [activeTab, setActiveTab] = useState<Tab>('pending')
  const [pendingActions, setPendingActions] = useState(initialPending)
  const [agentTypeFilter, setAgentTypeFilter] = useState('')

  function handleRemove(id: string) {
    setPendingActions((prev) => prev.filter((a) => a.id !== id))
  }

  const filteredHistory = agentTypeFilter
    ? history.filter((a) => a.agent_type === agentTypeFilter)
    : history

  return (
    <div className="p-8 max-w-7xl mx-auto space-y-10">
      {/* Tab bar */}
      <div className="flex bg-surface-container-low p-1 rounded-xl w-fit">
        <button
          onClick={() => setActiveTab('pending')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'pending'
              ? 'bg-surface-container-lowest text-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Pending
          {pendingActions.length > 0 && (
            <span className="ml-2 px-1.5 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed text-[10px] font-bold rounded-full">
              {pendingActions.length}
            </span>
          )}
        </button>
        <button
          onClick={() => setActiveTab('activity')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'activity'
              ? 'bg-surface-container-lowest text-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Activity Log
        </button>
        <button
          onClick={() => setActiveTab('settings')}
          className={`px-4 py-2 text-sm font-semibold rounded-lg transition-all ${
            activeTab === 'settings'
              ? 'bg-surface-container-lowest text-primary shadow-sm'
              : 'text-on-surface-variant hover:text-on-surface'
          }`}
        >
          Settings
        </button>
      </div>

      {/* Pending tab */}
      {activeTab === 'pending' && (
        <section className="space-y-6">
          <div className="flex items-center gap-3">
            <h3 className="text-xl font-bold text-on-surface">Waiting for your approval</h3>
            {pendingActions.length > 0 && (
              <span className="px-2.5 py-0.5 bg-tertiary-fixed text-on-tertiary-fixed text-[11px] font-bold uppercase tracking-wider rounded-full">
                {pendingActions.length} pending
              </span>
            )}
          </div>

          {pendingActions.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <Bot className="w-12 h-12 text-on-surface-variant/30" />
              <p className="text-base font-semibold text-on-surface">No pending actions</p>
              <p className="text-sm text-on-surface-variant">
                Agents are watching your stock
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
              {pendingActions.map((action) => (
                <ActionCard key={action.id} action={action} onRemove={handleRemove} />
              ))}
            </div>
          )}
        </section>
      )}

      {/* Activity log tab */}
      {activeTab === 'activity' && (
        <section className="space-y-6">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-bold text-on-surface">Agent Activity Log</h3>
            <select
              value={agentTypeFilter}
              onChange={(e) => setAgentTypeFilter(e.target.value)}
              className="text-sm bg-surface-container-lowest rounded-lg px-3 py-2 outline-none text-on-surface font-mono focus:ring-2 focus:ring-[#E1E0FF]"
            >
              {AGENT_FILTER_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </div>

          {filteredHistory.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-24 space-y-3">
              <History className="w-12 h-12 text-on-surface-variant/30" />
              <p className="text-base font-semibold text-on-surface">No activity yet</p>
              <p className="text-sm text-on-surface-variant">
                Agent actions will appear here once they run
              </p>
            </div>
          ) : (
            <div className="bg-surface-container-low rounded-2xl p-6 space-y-1">
              {filteredHistory.map((action) => (
                <div
                  key={action.id}
                  className="flex items-center gap-4 py-3 hover:bg-surface-container-high/50 rounded-lg px-2 transition-colors"
                >
                  <div
                    className={`w-2.5 h-2.5 rounded-full shrink-0 ${STATUS_DOT[action.status ?? ''] ?? 'bg-outline-variant'}`}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-on-surface-variant">
                        {AGENT_LABELS[action.agent_type] ?? action.agent_type}
                      </span>
                      <span className="text-sm font-medium text-on-surface truncate">
                        {action.title}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <span
                      className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${STATUS_PILL[action.status ?? ''] ?? 'bg-surface-container text-on-surface-variant'}`}
                    >
                      {action.status}
                    </span>
                    <span className="font-mono text-[11px] text-on-surface-variant">
                      {timeAgo(action.triggered_at)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Settings tab */}
      {activeTab === 'settings' && (
        <section className="space-y-6 max-w-md">
          <h3 className="text-xl font-bold text-on-surface">Agent Settings</h3>
          <AgentSettings initialConfig={agentConfig} />
        </section>
      )}
    </div>
  )
}
