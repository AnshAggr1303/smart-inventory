import 'server-only'

export function billParsePrompt(rawText: string): string {
  return `You are a bill parsing assistant for an inventory management system.

Your task: extract all line items from the following purchase bill text.

Rules:
- Return ONLY a valid JSON array. No markdown, no explanation, no preamble.
- Each item must have exactly these fields:
  { "name": string, "quantity": number | null, "unit": string | null, "price_per_unit": number | null, "total_price": number | null }
- Use null for any value you cannot read clearly from the text.
- Never guess or invent values. If unsure, use null.
- If the text is not a bill or contains no items, return [].

Bill text:
${rawText}`
}
