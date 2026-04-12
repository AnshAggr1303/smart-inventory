import { type NextRequest } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { runDemandForecast } from '@/lib/agents/forecastAgent'

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

  const { data: orgs, error: orgsErr } = await serviceClient
    .from('organisations')
    .select('id')

  if (orgsErr || !orgs) {
    return Response.json({ error: 'Failed to fetch organisations' }, { status: 500 })
  }

  const summary: { org_id: string; actions_created: number; urgent_count: number }[] = []

  for (const org of orgs) {
    const { data: orgData } = await serviceClient
      .from('organisations')
      .select('agent_config')
      .eq('id', org.id)
      .single()

    const config = (orgData as unknown as { agent_config: { forecast_enabled?: boolean } | null })
      ?.agent_config
    if (config?.forecast_enabled === false) continue

    const { data: profile } = await serviceClient
      .from('user_profiles')
      .select('id')
      .eq('org_id', org.id)
      .limit(1)
      .single()

    if (!profile) continue

    try {
      const result = await runDemandForecast(org.id, profile.id, serviceClient)
      summary.push({ org_id: org.id, ...result })
    } catch {
      console.error(
        JSON.stringify({
          event: 'forecast_cron_org_failed',
          org_id: org.id,
          timestamp: new Date().toISOString(),
        })
      )
    }
  }

  const totalCreated = summary.reduce((sum, s) => sum + s.actions_created, 0)
  return Response.json({ actions_created: totalCreated, orgs_processed: orgs.length, summary })
}
