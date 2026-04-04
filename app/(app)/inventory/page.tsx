import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import InventoryClient from '@/app/(app)/inventory/InventoryClient'

export default async function InventoryPage() {
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

  const { data: items } = await supabase
    .from('items')
    .select('*')
    .eq('org_id', org_id)
    .eq('is_archived', false)
    .order('name')

  const allItems = items ?? []

  return (
    <div className="max-w-7xl mx-auto">
      <InventoryClient items={allItems} totalCount={allItems.length} />
    </div>
  )
}
