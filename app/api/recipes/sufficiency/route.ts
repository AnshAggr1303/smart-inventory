import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { checkRecipeSufficiency } from '@/lib/recipes/checkSufficiency'

const InputSchema = z.object({
  recipe_id: z.string().uuid(),
  quantity: z.number().positive().int(),
})

export async function POST(req: NextRequest) {
  try {
    const body: unknown = await req.json()
    const parsed = InputSchema.parse(body)

    // Derive org_id from authenticated session — never trust the client (Rule S2)
    const supabase = await createServerClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()

    if (!profile?.org_id) {
      return NextResponse.json({ error: 'Profile not found' }, { status: 403 })
    }

    const result = await checkRecipeSufficiency(
      parsed.recipe_id,
      parsed.quantity,
      profile.org_id as string
    )

    return NextResponse.json(result)
  } catch (err) {
    if (err instanceof z.ZodError) {
      return NextResponse.json({ error: err.issues[0]?.message }, { status: 400 })
    }
    return NextResponse.json({ error: 'Sufficiency check failed' }, { status: 500 })
  }
}
