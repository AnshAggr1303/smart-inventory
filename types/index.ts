import type { INDUSTRIES, TRANSACTION_TYPES, AGENT_TYPES, AGENT_STATUSES } from '@/lib/constants'

// ─── Scalar union types ───────────────────────────────────────────────────────

export type Industry = (typeof INDUSTRIES)[number]

export type TransactionType = (typeof TRANSACTION_TYPES)[number]

export type AgentType = (typeof AGENT_TYPES)[number]

export type AgentStatus = (typeof AGENT_STATUSES)[number]

export type StockStatus = 'ok' | 'low' | 'critical' | 'zero'

// ─── Domain objects (snake_case matching DB columns) ─────────────────────────

export interface Organisation {
  id: string
  name: string
  industry: Industry
  city: string | null
  created_at: string
  updated_at: string
}

export interface UserProfile {
  id: string
  org_id: string | null
  full_name: string | null
  role: string
  onboarding_complete: boolean
  created_at: string
}

export interface UserSettings {
  id: string
  user_id: string | null
  org_id: string | null
  /** AES-256-GCM encrypted JSON array of up to 3 Groq keys */
  groq_keys: string | null
  groq_key_index: number
  /** AES-256-GCM encrypted Gemini API key */
  gemini_key: string | null
  notify_email: boolean
  notify_push: boolean
  created_at: string
  updated_at: string
}

export interface Item {
  id: string
  org_id: string
  name: string
  /** Generated column: lower(trim(name)) — always use for matching, never raw name */
  name_normalised: string
  category: string | null
  current_stock: number
  unit: string
  reorder_point: number
  reorder_qty: number
  cost_per_unit: number | null
  track_expiry: boolean
  earliest_expiry: string | null
  preferred_supplier_id: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface Transaction {
  id: string
  org_id: string
  item_id: string
  type: TransactionType
  /** Positive for additions, negative for deductions */
  quantity: number
  unit: string
  /** Multiplier to convert this transaction's unit to item base unit */
  unit_multiplier: number
  cost_per_unit: number | null
  bill_id: string | null
  recipe_id: string | null
  agent_action_id: string | null
  note: string | null
  performed_by: string | null
  created_at: string
}

/** One line item inside bills.parsed_items (JSONB) */
export interface BillLineItem {
  name: string
  qty: number
  unit: string
  price_per_unit: number
  total_price: number
  matched_item_id: string | null
  confidence_score: number
}

export interface Bill {
  id: string
  org_id: string
  supplier_id: string | null
  supplier_name: string | null
  bill_date: string | null
  bill_number: string | null
  raw_ocr_text: string | null
  parsed_items: BillLineItem[] | null
  total_amount: number | null
  status: 'pending' | 'confirmed' | 'rejected'
  image_url: string | null
  created_by: string | null
  confirmed_at: string | null
  created_at: string
}

export interface Recipe {
  id: string
  org_id: string
  name: string
  category: string | null
  yield_qty: number
  yield_unit: string
  notes: string | null
  is_archived: boolean
  created_at: string
  updated_at: string
}

export interface RecipeIngredient {
  id: string
  org_id: string
  recipe_id: string
  item_id: string
  quantity: number
  unit: string
  unit_multiplier: number
  created_at: string
}

export interface Supplier {
  id: string
  org_id: string
  name: string
  /** Generated column: lower(trim(name)) */
  name_normalised: string
  phone: string | null
  email: string | null
  address: string | null
  total_orders: number
  total_spend: number
  notes: string | null
  is_active: boolean
  created_at: string
  updated_at: string
}

// ─── Agent action payloads ────────────────────────────────────────────────────

export interface ReorderPayload {
  item_id: string
  qty: number
  unit: string
  supplier_id: string | null
  estimated_cost: number | null
}

export interface ShrinkagePayload {
  item_id: string
  expected_qty: number
  actual_qty: number
  variance: number
}

export interface DemandForecastPayload {
  item_id: string
  predicted_qty: number
  period: string
  confidence: number
}

export interface AgentAction {
  id: string
  org_id: string
  agent_type: AgentType
  status: AgentStatus
  title: string
  description: string | null
  payload: ReorderPayload | ShrinkagePayload | DemandForecastPayload | null
  triggered_at: string
  reviewed_by: string | null
  reviewed_at: string | null
  executed_at: string | null
  error_message: string | null
  created_at: string
}

export interface UnitConversion {
  id: string
  from_unit: string
  to_unit: string
  /** Multiply value in from_unit by this to get value in to_unit */
  multiplier: number
}
