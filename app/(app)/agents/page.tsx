import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { AgentsClient } from './AgentsClient'
import type { Json } from '@/types/supabase'

// ─── Types ────────────────────────────────────────────────────────────────────

type AgentConfig = {
  reorder_enabled: boolean
  shrinkage_enabled: boolean
  forecast_enabled: boolean
  shrinkage_threshold_pct: number
  forecast_horizon_days: number
  reorder_lead_time_days: number
}

const DEFAULT_CONFIG: AgentConfig = {
  reorder_enabled: true,
  shrinkage_enabled: true,
  forecast_enabled: true,
  shrinkage_threshold_pct: 5,
  forecast_horizon_days: 7,
  reorder_lead_time_days: 3,
}

function parseAgentConfig(raw: Json | undefined): AgentConfig {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return DEFAULT_CONFIG
  const c = raw as Record<string, unknown>
  return {
    reorder_enabled: typeof c.reorder_enabled === 'boolean' ? c.reorder_enabled : true,
    shrinkage_enabled: typeof c.shrinkage_enabled === 'boolean' ? c.shrinkage_enabled : true,
    forecast_enabled: typeof c.forecast_enabled === 'boolean' ? c.forecast_enabled : true,
    shrinkage_threshold_pct:
      typeof c.shrinkage_threshold_pct === 'number' ? c.shrinkage_threshold_pct : 5,
    forecast_horizon_days:
      typeof c.forecast_horizon_days === 'number' ? c.forecast_horizon_days : 7,
    reorder_lead_time_days:
      typeof c.reorder_lead_time_days === 'number' ? c.reorder_lead_time_days : 3,
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AgentsPage() {
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

  if (!profile?.org_id) redirect('/onboarding')

  const org_id = profile.org_id

  // Fetch agent_actions ordered by most recent
  const { data: actions } = await supabase
    .from('agent_actions')
    .select(
      'id, agent_type, title, description, payload, triggered_at, status'
    )
    .eq('org_id', org_id)
    .order('triggered_at', { ascending: false })
    .limit(100)

  const allActions = (actions ?? []).map((a) => ({
    ...a,
    payload: a.payload as Record<string, unknown> | null,
  }))

  const pending = allActions.filter((a) => a.status === 'pending')
  const history = allActions

  // Fetch agent_config from organisations
  const { data: org } = await supabase
    .from('organisations')
    .select('agent_config')
    .eq('id', org_id)
    .single()

  const agentConfig = parseAgentConfig(
    (org as unknown as { agent_config?: Json })?.agent_config
  )

  return (
    <div className="min-h-screen bg-surface">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-surface/80 backdrop-blur-xl px-8 py-6 flex items-center justify-between"
        style={{ borderBottom: '1px solid rgba(198, 196, 217, 0.15)' }}>
        <div>
          <h2 className="text-3xl font-bold tracking-tight text-on-surface">Agents</h2>
          <p className="text-sm text-on-surface-variant">
            Manage your autonomous procurement assistants.
          </p>
        </div>
      </header>

      <AgentsClient
        pending={pending}
        history={history}
        agentConfig={agentConfig}
      />
    </div>
  )
}
