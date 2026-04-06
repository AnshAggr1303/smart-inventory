import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { BILL_IMAGES_BUCKET } from '@/lib/constants'

// ─── Input schema ─────────────────────────────────────────────────────────────

const confirmedItemSchema = z.object({
  item_id: z.string().uuid().nullable(),
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  price_per_unit: z.number().nullable(),
  is_new_item: z.boolean(),
})

const confirmSchema = z.object({
  items: z.array(confirmedItemSchema).min(1),
  supplier_name: z.string(),
  bill_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bill_number: z.string(),
  image_base64: z.string().nullable(),
  image_mime_type: z.string().nullable(),
})

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Authenticate
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) {
    return NextResponse.json({ error: 'Organisation not found' }, { status: 401 })
  }

  const org_id = profile.org_id
  const user_id = user.id

  // 2. Validate input
  const body: unknown = await request.json()
  const parsed = confirmSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request. Check all items have a name and quantity > 0.' },
      { status: 400 }
    )
  }

  const { items, supplier_name, bill_date, bill_number, image_base64, image_mime_type } =
    parsed.data

  // 3. Upload image to storage if provided
  let image_url: string | null = null

  if (image_base64 && image_mime_type) {
    try {
      const billImageId = crypto.randomUUID()
      const now = new Date(bill_date)
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const extension = image_mime_type.includes('png') ? 'png' : 'jpg'
      const storagePath = `${org_id}/${year}/${month}/${billImageId}.${extension}`

      const binaryStr = atob(image_base64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }

      const { error: uploadError } = await supabase.storage
        .from(BILL_IMAGES_BUCKET)
        .upload(storagePath, bytes, {
          contentType: image_mime_type,
          upsert: false,
        })

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from(BILL_IMAGES_BUCKET)
          .getPublicUrl(storagePath)
        image_url = urlData.publicUrl
      }
      // If upload fails, continue without image — not a blocking error
    } catch {
      // Image upload failure is non-fatal — bill can still be confirmed
    }
  }

  // 4. Build items payload for the RPC
  const rpcItems = items.map((item) => ({
    item_id: item.item_id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unit_multiplier: 1, // Phase 1: always 1, unit conversion in Phase 2
    price_per_unit: item.price_per_unit,
    is_new_item: item.is_new_item,
  }))

  // 5. Call atomic RPC — creates bill + items + transactions in one transaction
  const { data: bill_id, error: rpcError } = await (
    supabase as unknown as {
      rpc: (
        name: string,
        args: Record<string, unknown>
      ) => Promise<{ data: string | null; error: unknown }>
    }
  ).rpc('confirm_bill_and_update_stock', {
    p_org_id: org_id,
    p_user_id: user_id,
    p_supplier_name: supplier_name || null,
    p_bill_date: bill_date,
    p_bill_number: bill_number || null,
    p_image_url: image_url,
    p_items: rpcItems,
  })

  if (rpcError) {
    return NextResponse.json(
      { error: 'Failed to save bill. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    bill_id,
    items_added: items.length,
  })
}
