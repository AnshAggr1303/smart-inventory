import 'server-only'

import { getGroqKeys, advanceGroqIndex } from '@/lib/llm/getKeys'
import {
  GroqAllKeysExhaustedError,
  GroqKeyInvalidError,
} from '@/lib/llm/errors'
import { GROQ_MODEL_LARGE } from '@/lib/constants'

const GROQ_API_URL =
  'https://api.groq.com/openai/v1/chat/completions'

type GroqMessage = {
  role: 'system' | 'user' | 'assistant'
  content: string
}

type CallGroqParams = {
  messages: GroqMessage[]
  model?: string
  temperature?: number
  max_tokens?: number
  user_id: string
  org_id: string
}

export async function callGroq(params: CallGroqParams): Promise<string> {
  const { messages, model = GROQ_MODEL_LARGE, temperature = 0.2, max_tokens = 1000, user_id } =
    params

  const { keys, current_index } = await getGroqKeys(user_id)

  // Build a list of key indices to try, starting from current_index
  const indices = Array.from({ length: keys.length }, (_, i) => (current_index + i) % keys.length)

  let lastError: Error = new GroqAllKeysExhaustedError()

  for (const keyIndex of indices) {
    const key = keys[keyIndex]
    if (!key) continue

    let res: Response
    try {
      res = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ model, messages, temperature, max_tokens }),
      })
    } catch (networkError) {
      lastError = networkError instanceof Error ? networkError : new Error(String(networkError))
      continue
    }

    if (res.status === 401) {
      throw new GroqKeyInvalidError(keyIndex)
    }

    if (res.status === 429) {
      // Rate limited — try next key
      lastError = new GroqAllKeysExhaustedError()
      continue
    }

    if (!res.ok) {
      lastError = new Error(`Groq API error: ${res.status}`)
      continue
    }

    const json = (await res.json()) as {
      choices?: { message?: { content?: string } }[]
    }

    const content = json.choices?.[0]?.message?.content
    if (typeof content !== 'string') {
      lastError = new Error('Groq API returned an unexpected response shape')
      continue
    }

    // Success — advance the key index for the next call
    await advanceGroqIndex(user_id, keyIndex)

    return content
  }

  throw lastError
}
