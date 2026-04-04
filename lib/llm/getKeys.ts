import 'server-only'

import { createServerClient } from '@/lib/supabase/server'
import { decryptKey } from '@/lib/crypto/encryptKey'
import { GROQ_KEY_COUNT } from '@/lib/constants'
import { GeminiKeyMissingError } from '@/lib/llm/errors'

export async function getGroqKeys(user_id: string): Promise<{
  keys: string[]
  current_index: number
}> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('user_settings')
    .select('groq_keys, groq_key_index')
    .eq('user_id', user_id)
    .single()

  if (error || !data) {
    throw new Error('Could not load Groq keys from user settings')
  }

  const current_index = data.groq_key_index ?? 0

  if (!data.groq_keys) {
    throw new Error('No Groq keys configured. Add keys in Settings.')
  }

  let rawKeys: unknown
  try {
    rawKeys = JSON.parse(data.groq_keys)
  } catch {
    throw new Error('Groq keys storage is corrupted. Please re-enter your keys in Settings.')
  }

  if (!Array.isArray(rawKeys)) {
    throw new Error('Groq keys storage is corrupted. Please re-enter your keys in Settings.')
  }

  const keys: string[] = []
  for (const entry of rawKeys) {
    if (typeof entry !== 'string' || entry.trim() === '') continue
    try {
      const decrypted = decryptKey(entry)
      if (decrypted.trim() !== '') keys.push(decrypted)
    } catch {
      // Skip keys that fail to decrypt — they may be malformed
    }
  }

  if (keys.length === 0) {
    throw new Error('No valid Groq keys found. Add keys in Settings.')
  }

  return { keys, current_index }
}

export async function getGeminiKey(user_id: string): Promise<string> {
  const supabase = await createServerClient()

  const { data, error } = await supabase
    .from('user_settings')
    .select('gemini_key')
    .eq('user_id', user_id)
    .single()

  if (error || !data || !data.gemini_key) {
    throw new GeminiKeyMissingError()
  }

  const decrypted = decryptKey(data.gemini_key)
  if (decrypted.trim() === '') {
    throw new GeminiKeyMissingError()
  }

  return decrypted
}

export async function advanceGroqIndex(
  user_id: string,
  current_index: number
): Promise<void> {
  const supabase = await createServerClient()

  const next_index = (current_index + 1) % GROQ_KEY_COUNT

  await supabase
    .from('user_settings')
    .update({ groq_key_index: next_index })
    .eq('user_id', user_id)
}
