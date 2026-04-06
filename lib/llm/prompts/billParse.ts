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

export function billVisionPrompt(): string {
  return `You are reading a purchase bill or invoice image.

Extract ALL line items you can see.
Return ONLY a valid JSON array. No explanation, no markdown, no preamble.

Each item must have exactly these fields:
{
  "name": "item name as written on bill",
  "quantity": numeric value only or null if not visible,
  "unit": "unit as written (kg, g, pcs, etc) or null if not visible",
  "price_per_unit": numeric or null if not visible,
  "total_price": numeric or null if not visible
}

Rules:
- Use null for any value you cannot read clearly.
- Never guess or invent values. If unsure, use null.
- Strip currency symbols from price values — return numbers only.
- If the image is not a bill or is completely unreadable, return [].`
}
