import 'server-only'

import { getGeminiKey } from '@/lib/llm/getKeys'
import { GeminiKeyMissingError, GeminiRateLimitError } from '@/lib/llm/errors'
import { GEMINI_MODEL } from '@/lib/constants'

const GEMINI_BASE_URL =
  'https://generativelanguage.googleapis.com/v1beta/models'

type GeminiResponseBody = {
  candidates?: {
    content?: {
      parts?: { text?: string }[]
    }
  }[]
}

function extractText(body: GeminiResponseBody): string {
  const text = body.candidates?.[0]?.content?.parts?.[0]?.text
  if (typeof text !== 'string') {
    throw new Error('Gemini API returned an unexpected response shape')
  }
  return text
}

type CallGeminiTextParams = {
  prompt: string
  user_id: string
  org_id: string
}

export async function callGeminiText(params: CallGeminiTextParams): Promise<string> {
  const { prompt, user_id } = params

  let apiKey: string
  try {
    apiKey = await getGeminiKey(user_id)
  } catch {
    throw new GeminiKeyMissingError()
  }

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  })

  if (res.status === 429) throw new GeminiRateLimitError()
  if (res.status === 400 || res.status === 403) throw new GeminiKeyMissingError()
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)

  const json = (await res.json()) as GeminiResponseBody
  return extractText(json)
}

type CallGeminiVisionParams = {
  prompt: string
  imageBase64: string
  mimeType: 'image/jpeg' | 'image/png' | 'application/pdf'
  user_id: string
  org_id: string
}

export async function callGeminiVision(params: CallGeminiVisionParams): Promise<string> {
  const { prompt, imageBase64, mimeType, user_id } = params

  let apiKey: string
  try {
    apiKey = await getGeminiKey(user_id)
  } catch {
    throw new GeminiKeyMissingError()
  }

  const url = `${GEMINI_BASE_URL}/${GEMINI_MODEL}:generateContent?key=${apiKey}`

  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [
        {
          parts: [
            { text: prompt },
            { inlineData: { mimeType, data: imageBase64 } },
          ],
        },
      ],
    }),
  })

  if (res.status === 429) throw new GeminiRateLimitError()
  if (res.status === 400 || res.status === 403) throw new GeminiKeyMissingError()
  if (!res.ok) throw new Error(`Gemini API error: ${res.status}`)

  const json = (await res.json()) as GeminiResponseBody
  return extractText(json)
}
