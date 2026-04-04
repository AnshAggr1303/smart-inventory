import 'server-only'

export class GroqAllKeysExhaustedError extends Error {
  constructor() {
    super('All Groq keys exhausted or rate limited')
    this.name = 'GroqAllKeysExhaustedError'
  }
}

export class GroqKeyInvalidError extends Error {
  constructor(public keyIndex: number) {
    super(`Groq key at index ${keyIndex} is invalid`)
    this.name = 'GroqKeyInvalidError'
  }
}

export class GeminiKeyMissingError extends Error {
  constructor() {
    super('Gemini API key not configured')
    this.name = 'GeminiKeyMissingError'
  }
}

export class GeminiRateLimitError extends Error {
  constructor() {
    super('Gemini API rate limit reached')
    this.name = 'GeminiRateLimitError'
  }
}

export class LLMFallbackUsedError extends Error {
  constructor(public task: string) {
    super(`LLM unavailable for ${task} — fallback used`)
    this.name = 'LLMFallbackUsedError'
  }
}
