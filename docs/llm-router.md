## SECTION 4: LLM ROUTER MODULE

---

### Overview

Every AI task in the app goes through one central router at
/lib/llm/router.ts — never call Groq or Gemini directly
from anywhere else. The router decides which model to use,
handles key rotation, manages errors, and falls back
gracefully if a provider fails.

No LLM call ever happens client-side. All calls are made
from Server Actions or API routes only.

---

### Groq — round-robin across 3 keys

The user provides up to 3 Groq API keys during onboarding.
We rotate through them in order to distribute load and avoid
hitting the rate limit on any single key.

Round-robin logic:

1. Read `user_settings.groq_keys` (encrypted JSON array)
2. Read `user_settings.groq_key_index` (0, 1, or 2)
3. Decrypt the key at current index
4. Make the API call
5. On success → increment index by 1, wrap back to 0
   after 2. Save new index to DB.
6. On rate limit (429) → immediately try next key without
   incrementing. If all 3 keys are rate limited → wait 10
   seconds, try again once. If still failing → fall back to
   rule-based response and notify user.
7. On auth error (401) → mark that key as invalid, skip it,
   try next key. Flag to user in settings: "Key 2 is invalid,
   please replace it."
```typescript
// /lib/llm/groqClient.ts

type GroqTask = {
  messages: { role: string; content: string }[]
  model?: string        // default: llama3-70b-8192
  temperature?: number  // default: 0.2 for structured tasks
  max_tokens?: number   // default: 1000
  org_id: string
  user_id: string
}

async function callGroq(task: GroqTask): Promise<string>
// Returns the text content of the first choice
// Throws GroqAllKeysExhaustedError if all 3 keys fail
```

Default model: `llama3-70b-8192`
For agent reasoning tasks: `llama3-70b-8192`
For fast extraction tasks: `llama3-8b-8192` (faster, cheaper
on rate limits)

---

### Gemini — vision + co-pilot

Used for two things only:
1. Reading bill photos (vision)
2. Natural language co-pilot chat

The user provides one Gemini API key. No rotation needed —
Gemini Flash free tier is 1500 requests/day which is more
than enough for any SME.
```typescript
// /lib/llm/geminiClient.ts

type GeminiTextTask = {
  prompt: string
  org_id: string
  user_id: string
}

type GeminiVisionTask = {
  prompt: string
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'application/pdf'
  org_id: string
  user_id: string
}

async function callGeminiText(task: GeminiTextTask): Promise<string>
async function callGeminiVision(task: GeminiVisionTask): Promise<string>
// Both throw GeminiKeyMissingError if key not configured
// Both throw GeminiRateLimitError if 429 received
```

Default model: `gemini-1.5-flash`

---

### Central router
```typescript
// /lib/llm/router.ts

type LLMTaskType =
  | 'bill_parse'        // extract items from OCR text → Groq
  | 'item_normalise'    // match/normalise item names → Groq
  | 'agent_reason'      // agent decision making → Groq
  | 'demand_forecast'   // predict demand → Groq
  | 'bill_vision'       // read bill photo → Gemini
  | 'copilot_chat'      // natural language query → Gemini
  | 'shrinkage_analyse' // variance analysis → Groq

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

async function routeLLMTask(input: LLMRouterInput):
  Promise<LLMRouterOutput>
```

Routing table:

| Task              | Primary    | Fallback          |
|-------------------|------------|-------------------|
| bill_parse        | Groq fast  | Rule-based parser |
| item_normalise    | Groq fast  | Exact string match|
| agent_reason      | Groq large | Rule-based logic  |
| demand_forecast   | Groq large | 30-day average    |
| bill_vision       | Gemini     | Tesseract only    |
| copilot_chat      | Gemini     | Canned responses  |
| shrinkage_analyse | Groq large | Simple variance % |

---

### Rule-based fallbacks

Every task has a fallback that works without any LLM.
The app must never be completely broken if keys are missing
or rate limits are hit.

bill_parse fallback:
- Split OCR text by newlines
- Regex match for patterns like "5 kg paneer 1700"
- Return structured items with low confidence score
- Show user "AI unavailable — please verify these items"

item_normalise fallback:
- Lowercase + trim the incoming name
- Check against `items.name_normalised` in DB
- Return exact match or null (user picks manually)

demand_forecast fallback:
- Calculate 30-day rolling average consumption per item
- Multiply by reorder lead time days
- Return as suggested reorder quantity

copilot_chat fallback:
- Match query against a small set of templates:
  "how much [item]" → query items table directly
  "low stock" → return items below reorder_point
  "recent bills" → return last 5 bills
- Return structured data, not prose

---

### Key retrieval helper

Used internally by groqClient and geminiClient.
Never called directly from features.
```typescript
// /lib/llm/getKeys.ts

async function getGroqKeys(user_id: string): Promise<{
  keys: string[]        // decrypted, max 3
  current_index: number
}>

async function getGeminiKey(user_id: string): Promise<string>
// Throws GeminiKeyMissingError if not set

async function advanceGroqIndex(user_id: string): Promise<void>
// Increments groq_key_index, wraps 2 → 0
```

---

### Error types
```typescript
// /lib/llm/errors.ts

class GroqAllKeysExhaustedError extends Error {}
class GroqKeyInvalidError extends Error {
  constructor(public keyIndex: number) { super() }
}
class GeminiKeyMissingError extends Error {}
class GeminiRateLimitError extends Error {}
class LLMFallbackUsedError extends Error {}
// not really an error — signals fallback was used
// caller should add a UI notice
```

---

### Usage example (inside a Server Action)
```typescript
// Example: parsing a bill
import { routeLLMTask } from '@/lib/llm/router'

const result = await routeLLMTask({
  task: 'bill_parse',
  payload: { raw_text: ocrText },
  org_id,
  user_id
})

// result.result is a JSON string — parse it
// result.fallback_used → show warning banner if true
```

---

### Logging rules

- Log task type, model used, latency, fallback_used — server only
- NEVER log the prompt content (may contain bill data = PII)
- NEVER log API keys even partially
- NEVER log org_id or user_id in the same line as key info
- Use structured logging: { task, model, latency_ms,
  fallback_used, timestamp } — no sensitive fields