import 'server-only'

import { z } from 'zod'
import { callGroq } from '@/lib/llm/groqClient'
import { callGeminiText, callGeminiVision } from '@/lib/llm/geminiClient'
import {
  billParseFallback,
  itemNormaliseFallback,
  demandForecastFallback,
  copilotFallback,
} from '@/lib/llm/fallbacks'
import { billParsePrompt } from '@/lib/llm/prompts/billParse'
import { itemNormalisePrompt } from '@/lib/llm/prompts/itemNormalise'
import { reorderDraftPrompt } from '@/lib/llm/prompts/agentReason'
import { copilotPrompt } from '@/lib/llm/prompts/copilotChat'
import {
  GroqAllKeysExhaustedError,
  GeminiKeyMissingError,
  GeminiRateLimitError,
} from '@/lib/llm/errors'
import { GROQ_MODEL_FAST, GROQ_MODEL_LARGE } from '@/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

type LLMTaskType =
  | 'bill_parse'
  | 'item_normalise'
  | 'agent_reason'
  | 'demand_forecast'
  | 'bill_vision'
  | 'copilot_chat'
  | 'shrinkage_analyse'

type LLMRouterInput = {
  task: LLMTaskType
  payload: Record<string, unknown>
  org_id: string
  user_id: string
}

type LLMRouterOutput = {
  result: string
  model_used: string
  fallback_used: boolean
}

// ─── Zod schemas for JSON-returning tasks ─────────────────────────────────────

const billItemSchema = z.array(
  z.object({
    name: z.string(),
    quantity: z.number().nullable(),
    unit: z.string().nullable(),
    price_per_unit: z.number().nullable(),
    total_price: z.number().nullable(),
  })
)

const itemNormaliseSchema = z.array(
  z.object({
    extracted_name: z.string(),
    matched_id: z.string().nullable(),
    matched_name: z.string().nullable(),
    confidence: z.number(),
  })
)

// ─── Router ───────────────────────────────────────────────────────────────────

export async function routeLLMTask(input: LLMRouterInput): Promise<LLMRouterOutput> {
  const start = Date.now()
  let model_used = 'unknown'
  let fallback_used = false

  try {
    const output = await dispatch(input)
    model_used = output.model_used
    fallback_used = output.fallback_used

    console.log(
      JSON.stringify({
        event: 'llm_router',
        task: input.task,
        model_used,
        fallback_used,
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      })
    )

    return output
  } catch (err) {
    // dispatch() should never throw — this is a last-resort safety net
    console.error(
      JSON.stringify({
        event: 'llm_router_unexpected_error',
        task: input.task,
        error: err instanceof Error ? err.message : String(err),
        name: err instanceof Error ? err.name : 'unknown',
        latency_ms: Date.now() - start,
        timestamp: new Date().toISOString(),
      })
    )
    return {
      result: '',
      model_used: 'fallback',
      fallback_used: true,
    }
  }
}

// ─── Dispatch logic ───────────────────────────────────────────────────────────

async function dispatch(input: LLMRouterInput): Promise<LLMRouterOutput> {
  const { task, payload, user_id, org_id } = input

  switch (task) {
    case 'bill_parse':
      return handleBillParse(payload, user_id, org_id)

    case 'item_normalise':
      return handleItemNormalise(payload, user_id, org_id)

    case 'agent_reason':
      return handleAgentReason(payload, user_id, org_id)

    case 'demand_forecast':
      return handleDemandForecast(payload, user_id, org_id)

    case 'bill_vision':
      return handleBillVision(payload, user_id, org_id)

    case 'copilot_chat':
      return handleCopilotChat(payload, user_id, org_id)

    case 'shrinkage_analyse':
      return handleShrinkageAnalyse(payload, user_id, org_id)
  }
}

// ─── Task handlers ────────────────────────────────────────────────────────────

async function handleBillParse(
  payload: Record<string, unknown>,
  user_id: string,
  org_id: string
): Promise<LLMRouterOutput> {
  const raw_text = payload.raw_text as string

  try {
    const result = await callGroq({
      messages: [{ role: 'user', content: billParsePrompt(raw_text) }],
      model: GROQ_MODEL_FAST,
      user_id,
      org_id,
    })

    try {
      const parsed = billItemSchema.parse(JSON.parse(result))
      return { result: JSON.stringify(parsed), model_used: GROQ_MODEL_FAST, fallback_used: false }
    } catch {
      const fallback = billParseFallback(raw_text)
      return { result: JSON.stringify(fallback), model_used: 'fallback', fallback_used: true }
    }
  } catch (err) {
    if (isLLMFallbackError(err)) {
      const fallback = billParseFallback(raw_text)
      return { result: JSON.stringify(fallback), model_used: 'fallback', fallback_used: true }
    }
    throw err
  }
}

async function handleItemNormalise(
  payload: Record<string, unknown>,
  user_id: string,
  org_id: string
): Promise<LLMRouterOutput> {
  const extractedNames = payload.extracted_names as string[]
  const existingItems = payload.existing_items as { id: string; name: string }[]

  try {
    const result = await callGroq({
      messages: [
        { role: 'user', content: itemNormalisePrompt(extractedNames, existingItems) },
      ],
      model: GROQ_MODEL_FAST,
      user_id,
      org_id,
    })

    try {
      const parsed = itemNormaliseSchema.parse(JSON.parse(result))
      return { result: JSON.stringify(parsed), model_used: GROQ_MODEL_FAST, fallback_used: false }
    } catch {
      const fallbackResults = extractedNames.map((name) => {
        const match = itemNormaliseFallback(name, existingItems)
        return { extracted_name: name, ...match }
      })
      return {
        result: JSON.stringify(fallbackResults),
        model_used: 'fallback',
        fallback_used: true,
      }
    }
  } catch (err) {
    if (isLLMFallbackError(err)) {
      const fallbackResults = extractedNames.map((name) => {
        const match = itemNormaliseFallback(name, existingItems)
        return { extracted_name: name, ...match }
      })
      return {
        result: JSON.stringify(fallbackResults),
        model_used: 'fallback',
        fallback_used: true,
      }
    }
    throw err
  }
}

async function handleAgentReason(
  payload: Record<string, unknown>,
  user_id: string,
  org_id: string
): Promise<LLMRouterOutput> {
  const reorderPayload = payload as {
    item_name: string
    suggested_qty: number
    unit: string
    supplier_name: string | null
    business_name: string
  }

  try {
    const result = await callGroq({
      messages: [{ role: 'user', content: reorderDraftPrompt(reorderPayload) }],
      model: GROQ_MODEL_LARGE,
      user_id,
      org_id,
    })
    return { result, model_used: GROQ_MODEL_LARGE, fallback_used: false }
  } catch (err) {
    if (isLLMFallbackError(err)) {
      const supplier = reorderPayload.supplier_name ?? 'supplier'
      const fallback = `Hi ${supplier}, please send ${reorderPayload.suggested_qty} ${reorderPayload.unit} of ${reorderPayload.item_name} at your earliest convenience. Thank you.`
      return { result: fallback, model_used: 'fallback', fallback_used: true }
    }
    throw err
  }
}

async function handleDemandForecast(
  payload: Record<string, unknown>,
  user_id: string,
  org_id: string
): Promise<LLMRouterOutput> {
  const avg_daily = payload.avg_daily as number
  const lead_time_days = payload.lead_time_days as number
  const prompt = payload.prompt as string | undefined

  try {
    if (!prompt) throw new GroqAllKeysExhaustedError()

    const result = await callGroq({
      messages: [{ role: 'user', content: prompt }],
      model: GROQ_MODEL_LARGE,
      user_id,
      org_id,
    })
    return { result, model_used: GROQ_MODEL_LARGE, fallback_used: false }
  } catch (err) {
    if (isLLMFallbackError(err)) {
      const suggested = demandForecastFallback(avg_daily ?? 0, lead_time_days ?? 3)
      return {
        result: String(suggested),
        model_used: 'fallback',
        fallback_used: true,
      }
    }
    throw err
  }
}

async function handleBillVision(
  payload: Record<string, unknown>,
  user_id: string,
  org_id: string
): Promise<LLMRouterOutput> {
  const prompt = payload.prompt as string
  const imageBase64 = payload.image_base64 as string
  const mimeType = payload.mime_type as 'image/jpeg' | 'image/png' | 'application/pdf'

  try {
    const result = await callGeminiVision({ prompt, imageBase64, mimeType, user_id, org_id })
    return { result, model_used: 'gemini-vision', fallback_used: false }
  } catch (err) {
    if (isLLMFallbackError(err)) {
      // For vision, fallback means Tesseract handled it — caller passes tesseract_text
      const tesseractText = (payload.tesseract_text as string | undefined) ?? ''
      return { result: tesseractText, model_used: 'tesseract', fallback_used: true }
    }
    throw err
  }
}

async function handleCopilotChat(
  payload: Record<string, unknown>,
  user_id: string,
  org_id: string
): Promise<LLMRouterOutput> {
  const query = payload.query as string
  const context = payload.context as {
    industry: string
    business_name: string
    low_stock_items: { name: string; current_stock: number; unit: string }[]
    recent_transactions: number
  }

  try {
    const result = await callGeminiText({
      prompt: copilotPrompt(query, context),
      user_id,
      org_id,
    })
    return { result, model_used: 'gemini-text', fallback_used: false }
  } catch (err) {
    if (isLLMFallbackError(err)) {
      const fallback = copilotFallback(query, context.low_stock_items ?? [])
      return { result: fallback, model_used: 'fallback', fallback_used: true }
    }
    throw err
  }
}

async function handleShrinkageAnalyse(
  payload: Record<string, unknown>,
  user_id: string,
  org_id: string
): Promise<LLMRouterOutput> {
  const prompt = payload.prompt as string | undefined

  try {
    if (!prompt) throw new GroqAllKeysExhaustedError()

    const result = await callGroq({
      messages: [{ role: 'user', content: prompt }],
      model: GROQ_MODEL_LARGE,
      user_id,
      org_id,
    })
    return { result, model_used: GROQ_MODEL_LARGE, fallback_used: false }
  } catch (err) {
    if (isLLMFallbackError(err)) {
      const variance_pct = payload.variance_pct as number | undefined
      const item_name = payload.item_name as string | undefined
      const fallback =
        item_name && variance_pct !== undefined
          ? `${item_name} shows a ${variance_pct.toFixed(1)}% variance from expected stock levels.`
          : 'Variance analysis unavailable — AI service not configured.'
      return { result: fallback, model_used: 'fallback', fallback_used: true }
    }
    throw err
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isLLMFallbackError(err: unknown): boolean {
  return (
    err instanceof GroqAllKeysExhaustedError ||
    err instanceof GeminiKeyMissingError ||
    err instanceof GeminiRateLimitError
  )
}
