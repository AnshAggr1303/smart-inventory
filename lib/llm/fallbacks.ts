import 'server-only'

import { findBestMatch } from '@/lib/utils/fuzzyMatch'
import { normaliseUnit } from '@/lib/utils/unitAliases'
import { OCR_CONFIDENCE_THRESHOLD } from '@/lib/constants'

// ─── Bill parse fallback ──────────────────────────────────────────────────────
// Token-based extraction when Gemini/Groq is unavailable.
// Handles Tesseract OCR output where table columns collapse into one string.
// e.g. "1 Paneer Fresh 5 kg 340.00 1700.00" or "6 mustard oil 5 180.00 900.00"

const UNIT_WORDS = new Set([
  'kg', 'g', 'gm', 'gms', 'gram', 'grams',
  'l', 'lt', 'ltr', 'litre', 'litres', 'liter', 'liters',
  'ml', 'pcs', 'pc', 'piece', 'pieces',
  'box', 'boxes', 'bag', 'bags', 'ctn', 'carton',
  'nos', 'no', 'unit', 'units', 'dozen', 'doz', 'dz',
  'lb', 'lbs', 'oz', 'tab', 'tabs', 'strip', 'strips', 'pkt', 'pkts',
])

// ─── Filter: skip lines that are clearly not item lines ───────────────────────

function isItemLine(line: string): boolean {
  const lower = line.toLowerCase().trim()
  if (lower.length < 3) return false
  if (/^[\d\s.,\-=*|/\\]+$/.test(lower)) return false
  const skipWords = [
    'total', 'subtotal', 'tax', 'change', 'cash', 'receipt',
    'store', 'thank', 'welcome', 'address', 'phone', 'tel',
    'gst', 'gstin', 'invoice', 'bill to', 'bill no', 'date', 'time', 'no.',
    'supermarket', 'hypermarket', 'market', 'wholesale', 'supplier', 'provision',
    'item name', 'qty unit', 'rate amount', 'discount', 'subject to',
    'jurisdiction', 'goods once', 'authorised', 'signatory', 'received by',
    'thank you', 'payment',
  ]
  if (skipWords.some((w) => lower.includes(w))) return false
  return true
}

// ─── Strip leading row numbers / OCR misreads of "1" ─────────────────────────
// e.g. "2 maida" → "maida", "il paneer" → "paneer", "12 cumin seeds" → "cumin seeds"

function stripLeadingRowNumber(name: string): string {
  return name
    .replace(/^(il|l|i)?\s*\d+\.?\s+/, '')
    .replace(/^(il|l|i)\s+/, '')
    .trim()
}

type BillFallbackItem = {
  name: string
  quantity: number | null
  unit: string | null
  price_per_unit: number | null
  total_price: number | null
}

function parseNum(raw: string): number {
  return parseFloat(raw.replace(/,/g, ''))
}

function isNumToken(t: string): boolean {
  return /^[\d,]+\.?\d*$/.test(t)
}

// If a parsed price has > 4 integer digits it's likely two values Tesseract
// concatenated (e.g. "3800380" = "38.00" + "380.00"). Take the first segment.
function sanitisePrice(raw: number): number {
  if (raw <= 0) return raw
  const str = Math.round(raw).toString()
  if (str.length > 6) {
    // Take the first 2–4 digits as the real price
    const short = str.slice(0, 4)
    return parseInt(short, 10)
  }
  return raw
}

// Fix 4: if the last word of an already-extracted name is a bare integer,
// pull it out as quantity (handles "cumin seeds jeera 250" → qty=250).
function extractTrailingQty(
  name: string,
  currentQty: number | null,
): { name: string; quantity: number | null } {
  const words = name.split(' ')
  const last = words[words.length - 1] ?? ''
  if (/^\d+$/.test(last) && words.length > 1 && (currentQty === null || currentQty === 1)) {
    return {
      name: words.slice(0, -1).join(' '),
      quantity: parseInt(last, 10),
    }
  }
  return { name, quantity: currentQty }
}

// ─── Token-based row parser ───────────────────────────────────────────────────

// Compound unit pattern — Tesseract sometimes omits the space: "250g", "5kg", "10ml"
const COMPOUND_QTY_UNIT = /^(\d+(?:\.\d+)?)(kg|gms?|g|ltr?|ml|pcs?|lb|oz|tabs?|strips?|pkts?)$/i

function parseStructuredRow(line: string): BillFallbackItem | null {
  const rawTokens = line.trim().split(/\s+/)
  if (rawTokens.length < 2) return null

  // Expand compound tokens: "250g" → "250", "g"; "5kg" → "5", "kg"
  const expanded: string[] = []
  for (const tok of rawTokens) {
    const compound = COMPOUND_QTY_UNIT.exec(tok)
    if (compound) {
      expanded.push(compound[1]!, compound[2]!)
    } else {
      expanded.push(tok)
    }
  }

  // Fix 2: Tesseract often reads "l" (litre) as "1".
  // Heuristic: if a token is "1", the token before it is a pure integer (the qty),
  // and the token after it is a price-like number (≥2 digits), relabel it as "l".
  const toks = [...expanded]
  for (let i = 1; i < toks.length - 1; i++) {
    if (
      toks[i] === '1' &&
      /^\d+$/.test(toks[i - 1] ?? '') &&
      /^\d{2,}/.test(toks[i + 1] ?? '')
    ) {
      toks[i] = 'l'
    }
  }

  const unitIdx = toks.findIndex((t) => UNIT_WORDS.has(t.toLowerCase()))

  if (unitIdx !== -1) {
    // Unit found — qty is the token immediately before the unit
    const qtyIdx = unitIdx - 1
    const qtyToken = toks[qtyIdx]
    const qty = qtyToken && isNumToken(qtyToken) ? parseNum(qtyToken) : null

    // Name = everything before qty (or before unit if qty token is not a number)
    const nameEnd = qty !== null ? qtyIdx : unitIdx
    let nameTokens = toks.slice(0, nameEnd)
    if (nameTokens.length > 0 && /^\d+$/.test(nameTokens[0] ?? '')) {
      nameTokens = nameTokens.slice(1)
    }
    const rawName = stripLeadingRowNumber(nameTokens.join(' ').trim())
    if (!rawName || rawName.length < 2) return null

    // Prices: number tokens after the unit (sanitise each)
    const prices = toks
      .slice(unitIdx + 1)
      .filter(isNumToken)
      .map((t) => sanitisePrice(parseNum(t)))

    const { name, quantity } = extractTrailingQty(rawName, qty)

    let pricePerUnit = prices[0] ?? null
    const totalPrice = prices[1] ?? null

    // Cross-validate: if rate × qty ≠ total by a large factor, derive rate from total
    if (pricePerUnit !== null && totalPrice !== null && quantity !== null && quantity > 0) {
      const derived = totalPrice / quantity
      if (pricePerUnit > derived * 10) {
        pricePerUnit = Math.round(derived * 100) / 100
      }
    }

    console.log('[parser] tokens:', toks, '| unitIdx:', unitIdx, '| qtyIdx:', unitIdx - 1)

    return {
      name,
      quantity,
      unit: normaliseUnit(toks[unitIdx] ?? 'pcs'),
      price_per_unit: pricePerUnit,
      total_price: totalPrice,
    }
  }

  // No unit token found — classify numbers as: row_num?, qty?, rate, total
  const numPositions = toks
    .map((t, i) => ({ t, i }))
    .filter(({ t }) => isNumToken(t))

  if (numPositions.length >= 2) {
    const lastTwo = numPositions.slice(-2)
    const possibleQty = numPositions.slice(0, -2).pop()

    const nameStart = /^\d+$/.test(toks[0] ?? '') ? 1 : 0
    const nameEnd = possibleQty ? possibleQty.i : (lastTwo[0]?.i ?? toks.length)

    // Guard: if nameEnd ≤ nameStart we have no name tokens
    if (nameEnd <= nameStart) return null

    const rawName = stripLeadingRowNumber(toks.slice(nameStart, nameEnd).join(' ').trim())
    if (!rawName || rawName.length < 2) return null

    const baseQty = possibleQty ? parseNum(possibleQty.t) : null
    const { name, quantity } = extractTrailingQty(rawName, baseQty)

    return {
      name,
      quantity: quantity ?? 1,
      unit: 'pcs',
      price_per_unit: lastTwo[0] ? sanitisePrice(parseNum(lastTwo[0].t)) : null,
      total_price: lastTwo[1] ? sanitisePrice(parseNum(lastTwo[1].t)) : null,
    }
  }

  if (numPositions.length === 1) {
    const numPos = numPositions[0]!
    const nameStart = /^\d+$/.test(toks[0] ?? '') ? 1 : 0
    const nameParts = toks.filter((_, i) => i >= nameStart && i !== numPos.i)
    const rawName = stripLeadingRowNumber(nameParts.join(' ').trim())
    if (!rawName || rawName.length < 2) return null

    const { name, quantity } = extractTrailingQty(rawName, null)
    // If trailing qty was extracted, the single number is the price; else it's ambiguous — treat as price
    return {
      name,
      quantity: quantity ?? 1,
      unit: 'pcs',
      price_per_unit: quantity === null ? sanitisePrice(parseNum(numPos.t)) : null,
      total_price: null,
    }
  }

  // No numbers — bare name
  const rawName = stripLeadingRowNumber(toks.join(' ').trim())
  if (!rawName || rawName.length < 2) return null
  return { name: rawName, quantity: null, unit: null, price_per_unit: null, total_price: null }
}

export function billParseFallback(rawText: string): BillFallbackItem[] {
  return rawText
    .split('\n')
    .map((l) => l.trim())
    .filter(isItemLine)
    .map(parseStructuredRow)
    .filter((item): item is BillFallbackItem => item !== null)
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
