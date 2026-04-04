// ─── OCR pipeline ─────────────────────────────────────────────────────────────

/** Minimum Gemini/Tesseract confidence score to auto-accept an item match */
export const OCR_CONFIDENCE_THRESHOLD = 0.6

/** Maximum bill image size accepted for upload (enforced client + server) */
export const OCR_MAX_FILE_SIZE_MB = 10

// ─── Stock thresholds ─────────────────────────────────────────────────────────

/** current_stock / reorder_point below this ratio is flagged as critical */
export const CRITICAL_STOCK_THRESHOLD = 0.2

/** Decimal places stored in the DB for all quantity columns (numeric 12,4) */
export const STOCK_DECIMAL_PLACES = 4

/** Decimal places shown in the UI for quantity values */
export const DISPLAY_DECIMAL_PLACES = 2

// ─── Shrinkage detection agent ────────────────────────────────────────────────

/** Variance % above this triggers a shrinkage flag in the weekly report */
export const SHRINKAGE_FLAG_THRESHOLD_PCT = 5

/** Variance % above this marks a shrinkage flag as critical */
export const SHRINKAGE_CRITICAL_PCT = 15

// ─── Reorder agent ────────────────────────────────────────────────────────────

/** Assumed supplier lead time in days used by the reorder agent */
export const REORDER_LEAD_TIME_DAYS = 3

// ─── Demand forecaster agent ──────────────────────────────────────────────────

/** Number of days ahead the demand forecaster predicts */
export const FORECAST_HORIZON_DAYS = 7

/** Number of historical transaction days used to build the forecast model */
export const DEMAND_LOOKBACK_DAYS = 30

// ─── LLM configuration ────────────────────────────────────────────────────────

/** Number of Groq keys each user can register (round-robin load balancing) */
export const GROQ_KEY_COUNT = 3

/** Groq model used for tasks that need high reasoning quality */
export const GROQ_MODEL_LARGE = 'llama3-70b-8192'

/** Groq model used for fast, simple extraction tasks */
export const GROQ_MODEL_FAST = 'llama3-8b-8192'

/** Gemini model used for vision (bill scanning) and co-pilot chat */
export const GEMINI_MODEL = 'gemini-2.0-flash'

// ─── Expiry tracking ──────────────────────────────────────────────────────────

/** Days before expiry date when a warning badge is shown on an item */
export const EXPIRY_WARNING_DAYS = 3

// ─── Supabase storage ─────────────────────────────────────────────────────────

/** Storage bucket name for bill images uploaded during the OCR flow */
export const BILL_IMAGES_BUCKET = 'bill-images'

// ─── Domain enumerations (as const — derive union types from these) ───────────

/** All valid industry values — stored lowercase in organisations.industry */
export const INDUSTRIES = [
  'restaurant',
  'pharmacy',
  'retail',
  'hotel',
  'manufacturing',
  'other',
] as const

/** All valid transaction type values — stored in transactions.type */
export const TRANSACTION_TYPES = [
  'bill_addition',
  'manual_addition',
  'recipe_deduction',
  'manual_deduction',
  'adjustment',
  'wastage',
] as const

/** All valid agent type values — stored in agent_actions.agent_type */
export const AGENT_TYPES = [
  'reorder',
  'shrinkage',
  'demand_forecast',
] as const

/** All valid agent status values — stored in agent_actions.status */
export const AGENT_STATUSES = [
  'pending',
  'approved',
  'rejected',
  'executed',
  'failed',
] as const

// ─── Industry-specific UI labels ──────────────────────────────────────────────

type IndustryKey = (typeof INDUSTRIES)[number]

/**
 * What the "Recipe" concept is called in each industry.
 * Used to label the recipes module heading, buttons, and empty states.
 */
export const RECIPE_LABELS: Record<IndustryKey, string> = {
  restaurant: 'Recipe',
  pharmacy: 'Formula',
  retail: 'Kit',
  hotel: 'Service Kit',
  manufacturing: 'Bill of Materials',
  other: 'Recipe',
}
