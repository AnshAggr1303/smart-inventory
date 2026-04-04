import { NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'

export async function GET(): Promise<NextResponse> {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ count: 0 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (!profile?.org_id) {
    return NextResponse.json({ count: 0 })
  }

  const { count } = await supabase
    .from('agent_actions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', profile.org_id)
    .eq('status', 'pending')

  return NextResponse.json({ count: count ?? 0 })
}
