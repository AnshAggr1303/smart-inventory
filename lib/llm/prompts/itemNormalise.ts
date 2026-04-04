import 'server-only'

export function itemNormalisePrompt(
  extractedNames: string[],
  existingItems: { id: string; name: string }[]
): string {
  return `You are an inventory item matching assistant.

Your task: match each extracted item name to the closest existing inventory item.

Extracted names:
${JSON.stringify(extractedNames)}

Existing inventory items:
${JSON.stringify(existingItems)}

Rules:
- Return ONLY a valid JSON array. No markdown, no explanation, no preamble.
- Each entry must have exactly these fields:
  { "extracted_name": string, "matched_id": string | null, "matched_name": string | null, "confidence": number }
- confidence is a number from 0 to 1 (1 = identical match).
- Set matched_id and matched_name to null if no good match exists.
- Never invent a match with confidence below 0.6.
- Every extracted name must appear in the output exactly once.`
}
