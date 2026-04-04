/**
 * Manual smoke test for the LLM router.
 *
 * Requires the dev server to be running (`npm run dev`).
 * The route at /api/test-llm proxies into the Next.js runtime
 * where server-only modules work correctly.
 *
 * Usage:
 *   npx tsx scripts/testLLM.ts <user_id>
 *
 * Replace <user_id> with a real user_id from your Supabase auth.users table.
 * The user must have a Gemini key stored and encrypted in user_settings.
 *
 * This confirms the full chain:
 *   key retrieval → decrypt → Gemini API call → response
 *
 * Delete /app/api/test-llm/route.ts after testing.
 */

import { config } from 'dotenv'
import { resolve } from 'path'

config({ path: resolve(process.cwd(), '.env.local') })

async function main() {
  const user_id = process.argv[2]
  if (!user_id) {
    console.error('Usage: npx tsx scripts/testLLM.ts <user_id>')
    process.exit(1)
  }

  const url = `http://localhost:3000/api/test-llm?user_id=${encodeURIComponent(user_id)}`

  console.log(`Testing LLM router with user_id: ${user_id}`)
  console.log('Task: copilot_chat')
  console.log(`GET ${url}\n`)

  const res = await fetch(url)
  if (!res.ok) {
    console.error(`HTTP ${res.status}:`, await res.text())
    process.exit(1)
  }

  const output = (await res.json()) as {
    result: string
    model_used: string
    fallback_used: boolean
  }

  console.log('Result:', output.result)
  console.log('Model used:', output.model_used)
  console.log('Fallback used:', output.fallback_used)
}

main().catch((err) => {
  console.error('Test failed:', err)
  process.exit(1)
})
