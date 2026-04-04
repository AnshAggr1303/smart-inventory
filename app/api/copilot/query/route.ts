import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@/lib/supabase/server'
import { routeLLMTask } from '@/lib/llm/router'
import { z } from 'zod'

const BodySchema = z.object({
  query: z.string().min(1).max(500),
})

export async function POST(request: NextRequest): Promise<NextResponse> {
  const supabase = await createServerClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body: unknown = await request.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (!profile?.org_id) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }
  const org_id = profile.org_id

  // Fetch context for the copilot
  const { data: org } = await supabase
    .from('organisations')
    .select('name, industry')
    .eq('id', org_id)
    .single()

  const { data: items } = await supabase
    .from('items')
    .select('name, current_stock, unit, reorder_point')
    .eq('org_id', org_id)
    .eq('is_archived', false)

  const lowStockItems =
    items
      ?.filter((i) => i.reorder_point > 0 && i.current_stock <= i.reorder_point)
      .map((i) => ({ name: i.name, current_stock: i.current_stock, unit: i.unit })) ?? []

  const { data: transactionCountResult } = await supabase
    .from('transactions')
    .select('id', { count: 'exact', head: true })
    .eq('org_id', org_id)

  const output = await routeLLMTask({
    task: 'copilot_chat',
    payload: {
      query: parsed.data.query,
      context: {
        industry: org?.industry ?? 'other',
        business_name: org?.name ?? 'your business',
        low_stock_items: lowStockItems,
        recent_transactions: transactionCountResult ?? 0,
      },
    },
    org_id,
    user_id: user.id,
  })

  return NextResponse.json({ result: output.result, fallback_used: output.fallback_used })
}
