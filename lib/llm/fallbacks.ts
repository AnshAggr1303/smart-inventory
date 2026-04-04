import 'server-only'

import { findBestMatch } from '@/lib/utils/fuzzyMatch'
import { OCR_CONFIDENCE_THRESHOLD } from '@/lib/constants'

// ─── Bill parse fallback ──────────────────────────────────────────────────────
// Regex-based extraction when Groq is unavailable.
// Matches patterns like "5 kg paneer 1700" or "paneer 5kg".

const UNITS = [
  'kg', 'g', 'gm', 'gram', 'grams',
  'l', 'lt', 'ltr', 'litre', 'litres', 'liter', 'liters',
  'ml', 'pcs', 'pc', 'piece', 'pieces',
  'box', 'boxes', 'bag', 'bags', 'ctn', 'carton',
  'nos', 'no', 'unit', 'units', 'dozen', 'dz',
]

const UNIT_PATTERN = UNITS.join('|')

// Matches: optional_qty UNIT item_name  OR  item_name qty UNIT
const LINE_REGEX = new RegExp(
  `^(?:(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\.?\\s+)?(.+?)(?:\\s+(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\.?)?(?:\\s+\\d.*)?$`,
  'i'
)

// Separate simpler pattern: qty + unit at start of line
const QTY_UNIT_FIRST = new RegExp(
  `^(\\d+(?:\\.\\d+)?)\\s*(${UNIT_PATTERN})\\.?\\s+(.+?)(?:\\s+[\\d.,]+.*)?$`,
  'i'
)

type BillFallbackItem = {
  name: string
  quantity: number | null
  unit: string | null
  price_per_unit: null
  total_price: null
}

export function billParseFallback(rawText: string): BillFallbackItem[] {
  const lines = rawText
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2)

  const results: BillFallbackItem[] = []

  for (const line of lines) {
    const qtyFirst = QTY_UNIT_FIRST.exec(line)
    if (qtyFirst) {
      const [, qtyStr, unit, name] = qtyFirst
      const qty = qtyStr ? parseFloat(qtyStr) : null
      if (name && name.trim().length > 0) {
        results.push({
          name: name.trim(),
          quantity: qty !== null && !isNaN(qty) ? qty : null,
          unit: unit?.toLowerCase() ?? null,
          price_per_unit: null,
          total_price: null,
        })
        continue
      }
    }

    const m = LINE_REGEX.exec(line)
    if (m) {
      const [, qty1, unit1, name, qty2, unit2] = m
      const qty = qty1 ?? qty2
      const unit = unit1 ?? unit2
      if (name && name.trim().length > 0) {
        const parsedQty = qty ? parseFloat(qty) : null
        results.push({
          name: name.trim(),
          quantity: parsedQty !== null && !isNaN(parsedQty) ? parsedQty : null,
          unit: unit?.toLowerCase() ?? null,
          price_per_unit: null,
          total_price: null,
        })
      }
    }
  }

  return results
}

// ─── Item normalise fallback ──────────────────────────────────────────────────

export function itemNormaliseFallback(
  query: string,
  candidates: { id: string; name: string }[]
): { matched_id: string | null; matched_name: string | null; confidence: number } {
  if (candidates.length === 0) {
    return { matched_id: null, matched_name: null, confidence: 0 }
  }

  const names = candidates.map((c) => c.name)
  const best = findBestMatch(query, names)

  if (!best || best.score < OCR_CONFIDENCE_THRESHOLD) {
    return { matched_id: null, matched_name: null, confidence: best?.score ?? 0 }
  }

  const matched = candidates.find((c) => c.name === best.match)
  if (!matched) {
    return { matched_id: null, matched_name: null, confidence: 0 }
  }

  return {
    matched_id: matched.id,
    matched_name: matched.name,
    confidence: best.score,
  }
}

// ─── Demand forecast fallback ─────────────────────────────────────────────────

export function demandForecastFallback(
  avg_daily: number,
  lead_time_days: number
): number {
  return Math.ceil(avg_daily * lead_time_days * 2)
}

// ─── Copilot fallback ─────────────────────────────────────────────────────────

export function copilotFallback(
  query: string,
  low_stock_items: { name: string; current_stock: number; unit: string }[]
): string {
  const lower = query.toLowerCase()

  if (lower.includes('low stock') || lower.includes('running low') || lower.includes('reorder')) {
    if (low_stock_items.length === 0) {
      return 'All items are currently above their reorder points.'
    }
    const list = low_stock_items
      .map((i) => `${i.name}: ${i.current_stock} ${i.unit}`)
      .join(', ')
    return `Low stock items: ${list}.`
  }

  // Default — Gemini key not configured
  return 'Add your Gemini key in Settings to enable AI chat.'
}
