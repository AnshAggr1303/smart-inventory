import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { routeLLMTask } from '@/lib/llm/router'
import { billVisionPrompt } from '@/lib/llm/prompts/billParse'
import { billParseFallback } from '@/lib/llm/fallbacks'
import { normaliseExtractedItems, type RawExtractedItem } from '@/lib/ocr/normaliseItems'

// ─── Input schema ─────────────────────────────────────────────────────────────

const extractSchema = z.object({
  imageBase64: z.string(),
  mimeType: z.string(),
  tesseractText: z.string(),
  // org_id and user_id are ignored — always derived from session (rule S2)
})

// ─── Zod schema for parsed bill items ─────────────────────────────────────────

const rawItemSchema = z.array(
  z.object({
    name: z.string(),
    quantity: z.number().nullable(),
    unit: z.string().nullable(),
    price_per_unit: z.number().nullable(),
    total_price: z.number().nullable(),
  })
)

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Authenticate — org_id and user_id always from session
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
  const parsed = extractSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing image data.' }, { status: 400 })
  }

  const { imageBase64, mimeType, tesseractText } = parsed.data

  // 3. Call Gemini vision via LLM router
  // Always returns 200 — fallback to Tesseract if Gemini is unavailable
  const visionResult = await routeLLMTask({
    task: 'bill_vision',
    payload: {
      image_base64: imageBase64,
      mime_type: mimeType as 'image/jpeg' | 'image/png' | 'application/pdf',
      prompt: billVisionPrompt(),
      tesseract_text: tesseractText,
    },
    org_id,
    user_id,
  })

  // 4. Parse the vision result as JSON array of items
  let rawItems: RawExtractedItem[]
  let fallback_used = visionResult.fallback_used

  const jsonParseResult = rawItemSchema.safeParse(
    (() => {
      try {
        // Strip markdown code fences if Gemini wrapped the JSON
        const cleaned = visionResult.result
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/, '')
          .trim()
        return JSON.parse(cleaned)
      } catch {
        return null
      }
    })()
  )

  if (jsonParseResult.success) {
    rawItems = jsonParseResult.data
  } else {
    // JSON parse failed — Gemini returned text, or we got Tesseract text
    // Use the text-based bill parse fallback
    rawItems = billParseFallback(visionResult.result || tesseractText)
    fallback_used = true
  }

  if (rawItems.length === 0 && tesseractText.length > 10) {
    rawItems = billParseFallback(tesseractText)
    fallback_used = true
  }

  // 5. Normalise + match items to existing inventory
  const normalisedItems = await normaliseExtractedItems(rawItems, org_id, user_id)

  // 6. Respond — always 200 (OCR never returns 500)
  return NextResponse.json({
    items: normalisedItems,
    fallback_used,
  })
}
