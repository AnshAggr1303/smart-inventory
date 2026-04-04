import 'server-only'

export function reorderDraftPrompt(payload: {
  item_name: string
  suggested_qty: number
  unit: string
  supplier_name: string | null
  business_name: string
}): string {
  const supplier = payload.supplier_name ?? 'the supplier'
  return `Draft a short WhatsApp reorder message from ${payload.business_name} to ${supplier}.

Request: ${payload.suggested_qty} ${payload.unit} of ${payload.item_name}.

Rules:
- Under 3 sentences.
- Plain text only — no formatting, no bullet points, no markdown.
- Polite and specific.
- Include the item name, quantity, and unit.`
}
