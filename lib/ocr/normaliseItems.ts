import 'server-only'

import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { routeLLMTask } from '@/lib/llm/router'
import { findBestMatch } from '@/lib/utils/fuzzyMatch'
import { normaliseUnit } from '@/lib/utils/unitAliases'
import { OCR_CONFIDENCE_THRESHOLD } from '@/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RawExtractedItem = {
  name: string
  quantity: number | null
  unit: string | null
  price_per_unit: number | null
  total_price: number | null
}

export type NormalisedItem = {
  raw_name: string
  clean_name: string
  quantity: number | null
  unit: string
  price_per_unit: number | null
  total_price: number | null
  matched_item_id: string | null
  matched_item_name: string | null
  confidence_score: number   // 0–1
  is_new_item: boolean
}

// ─── Zod schema for LLM response ──────────────────────────────────────────────

const llmMatchSchema = z.array(
  z.object({
    extracted_name: z.string(),
    matched_id: z.string().nullable(),
    matched_name: z.string().nullable(),
    confidence: z.number(),
  })
)

// ─── Name cleaning ─────────────────────────────────────────────────────────────

function cleanName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function normaliseExtractedItems(
  items: RawExtractedItem[],
  org_id: string,
  user_id: string
): Promise<NormalisedItem[]> {
  if (items.length === 0) return []

  // 1. Clean names and normalise units
  const cleaned = items.map((item) => ({
    ...item,
    clean_name: cleanName(item.name),
    unit: normaliseUnit(item.unit ?? 'pcs'),
  }))

  // 2. Fetch existing items for this org
  const supabase = await createServerClient()
  const { data: existingItems, error: inventoryError } = await supabase
    .from('items')
    .select('id, name, name_normalised')
    .eq('org_id', org_id)
    .eq('is_archived', false)

  if (inventoryError) {
    console.error(
      JSON.stringify({
        event: 'normalise_items_inventory_fetch_failed',
        error: inventoryError.message,
        timestamp: new Date().toISOString(),
      })
    )
  }

  const inventory = existingItems ?? []

  // 3. Exact match first — confidence 1.0
  const exactMatched = new Map<string, { matched_item_id: string; matched_item_name: string }>()
  for (const cleaned_item of cleaned) {
    const exact = inventory.find((inv) => (inv.name_normalised ?? '') === cleaned_item.clean_name)
    if (exact) {
      exactMatched.set(cleaned_item.clean_name, {
        matched_item_id: exact.id,
        matched_item_name: exact.name,
      })
    }
  }

  // 4. Items without exact match → batch to LLM
  const needsFuzzy = cleaned.filter((c) => !exactMatched.has(c.clean_name))

  const llmMatches = new Map<
    string,
    { matched_id: string | null; matched_name: string | null; confidence: number }
  >()

  if (needsFuzzy.length > 0) {
    const extractedNames = needsFuzzy.map((c) => c.clean_name)
    const existingForLLM = inventory.map((inv) => ({ id: inv.id, name: inv.name }))

    try {
      const llmResult = await routeLLMTask({
        task: 'item_normalise',
        payload: {
          extracted_names: extractedNames,
          existing_items: existingForLLM,
        },
        org_id,
        user_id,
      })

      const parsed = llmMatchSchema.parse(JSON.parse(llmResult.result))
      for (const match of parsed) {
        llmMatches.set(match.extracted_name, {
          matched_id: match.matched_id,
          matched_name: match.matched_name,
          confidence: match.confidence,
        })
      }
    } catch {
      // LLM failed or parse failed — fall back to Levenshtein for each item
      for (const item of needsFuzzy) {
        const candidateNames = inventory.map((inv) => inv.name_normalised ?? inv.name)
        const best = findBestMatch(item.clean_name, candidateNames)
        if (best && best.score >= OCR_CONFIDENCE_THRESHOLD) {
          const matched = inventory.find(
            (inv) => (inv.name_normalised ?? inv.name) === best.match
          )
          llmMatches.set(item.clean_name, {
            matched_id: matched?.id ?? null,
            matched_name: matched?.name ?? null,
            confidence: best.score,
          })
        } else {
          llmMatches.set(item.clean_name, {
            matched_id: null,
            matched_name: null,
            confidence: best?.score ?? 0,
          })
        }
      }
    }
  }

  // 5. Build final NormalisedItem array
  return cleaned.map((item) => {
    const exact = exactMatched.get(item.clean_name)
    if (exact) {
      return {
        raw_name: item.name,
        clean_name: item.clean_name,
        quantity: item.quantity,
        unit: item.unit,
        price_per_unit: item.price_per_unit,
        total_price: item.total_price,
        matched_item_id: exact.matched_item_id,
        matched_item_name: exact.matched_item_name,
        confidence_score: 1.0,
        is_new_item: false,
      }
    }

    const fuzzy = llmMatches.get(item.clean_name)
    const confidence = fuzzy?.confidence ?? 0
    const is_new_item = !fuzzy?.matched_id || confidence < OCR_CONFIDENCE_THRESHOLD

    return {
      raw_name: item.name,
      clean_name: item.clean_name,
      quantity: item.quantity,
      unit: item.unit,
      price_per_unit: item.price_per_unit,
      total_price: item.total_price,
      matched_item_id: is_new_item ? null : (fuzzy?.matched_id ?? null),
      matched_item_name: is_new_item ? null : (fuzzy?.matched_name ?? null),
      confidence_score: confidence,
      is_new_item,
    }
  })
}
