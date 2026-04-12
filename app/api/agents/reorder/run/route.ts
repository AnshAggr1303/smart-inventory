import { type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { runReorderAgent } from '@/lib/agents/reorderAgent'

// Helper: service-role client for cross-org cron queries
function createServiceClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )
}

export async function GET(req: NextRequest): Promise<Response> {
  // CRON_SECRET check — must be the very first thing (Rule S5)
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const serviceClient = createServiceClient()

  // Get all orgs with reorder agent enabled (agent_config->reorder_enabled = true)
  const { data: orgs, error: orgsErr } = await serviceClient
    .from('organisations')
    .select('id')

  if (orgsErr || !orgs) {
    return Response.json({ error: 'Failed to fetch organisations' }, { status: 500 })
  }

  const summary: { org_id: string; actions_created: number; items_checked: number }[] = []

  for (const org of orgs) {
    // Get agent_config for this org
    const { data: orgData } = await serviceClient
      .from('organisations')
      .select('agent_config')
      .eq('id', org.id)
      .single()

    const config = (orgData as unknown as { agent_config: { reorder_enabled?: boolean } | null })
      ?.agent_config
    if (config?.reorder_enabled === false) continue

    // Find an org member to use their LLM keys
    const { data: profile } = await serviceClient
      .from('user_profiles')
      .select('id')
      .eq('org_id', org.id)
      .limit(1)
      .single()

    if (!profile) continue

    try {
      const result = await runReorderAgent({
        org_id: org.id,
        triggered_by: 'schedule',
        user_id: profile.id,
        supabaseClient: serviceClient,
      })
      summary.push({ org_id: org.id, ...result })
    } catch {
      // Log and continue — one org failing doesn't block others
      console.error(
        JSON.stringify({
          event: 'reorder_cron_org_failed',
          org_id: org.id,
          timestamp: new Date().toISOString(),
        })
      )
    }
  }

  const totalCreated = summary.reduce((sum, s) => sum + s.actions_created, 0)
  return Response.json({ actions_created: totalCreated, orgs_processed: orgs.length, summary })
}

/**
 * Named export for event-triggered calls from recipe deductions or bill confirms.
 * Call this after any stock movement that might push an item below reorder_point.
 */
export async function runReorderForOrg(
  org_id: string,
  user_id: string,
  specific_item_id?: string
): Promise<void> {
  try {
    await runReorderAgent({
      org_id,
      triggered_by: 'event',
      specific_item_id,
      user_id,
    })
  } catch {
    // Event-triggered runs must not crash the calling Server Action
    console.error(
      JSON.stringify({
        event: 'reorder_event_trigger_failed',
        org_id,
        specific_item_id,
        timestamp: new Date().toISOString(),
      })
    )
  }
}
