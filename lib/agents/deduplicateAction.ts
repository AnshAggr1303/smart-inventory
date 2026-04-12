import 'server-only'

import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '@/types/supabase'
import { createServerClient } from '@/lib/supabase/server'

/**
 * Returns true if a pending agent_action already exists
 * for the given org, agent type, and item_id in the payload.
 *
 * Pass a supabaseClient when calling from a cron route (service role client
 * bypasses RLS). Omit it from event-triggered Server Actions — it will create
 * a session-authenticated client automatically.
 *
 * Never throws — returns false on any error so agents degrade gracefully.
 */
export async function pendingActionExists(
  org_id: string,
  agent_type: string,
  item_id: string,
  supabaseClient?: SupabaseClient<Database>
): Promise<boolean> {
  try {
    const supabase = supabaseClient ?? (await createServerClient())

    const { data, error } = await supabase
      .from('agent_actions')
      .select('id')
      .eq('org_id', org_id)
      .eq('agent_type', agent_type)
      .eq('status', 'pending')
      .filter('payload->>item_id', 'eq', item_id)
      .limit(1)

    if (error) return false
    return (data?.length ?? 0) > 0
  } catch {
    return false
  }
}
