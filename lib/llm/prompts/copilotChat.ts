import 'server-only'

export function copilotPrompt(
  query: string,
  context: {
    industry: string
    business_name: string
    low_stock_items: { name: string; current_stock: number; unit: string }[]
    recent_transactions: number
  }
): string {
  const lowStockSummary =
    context.low_stock_items.length > 0
      ? context.low_stock_items
          .map((i) => `${i.name}: ${i.current_stock} ${i.unit}`)
          .join(', ')
      : 'none'

  return `You are an inventory assistant for ${context.business_name}, a ${context.industry} business.

Current inventory context:
- Low stock items: ${lowStockSummary}
- Recent transactions (last 30 days): ${context.recent_transactions}

User question: ${query}

Rules:
- Answer in 1–2 sentences maximum.
- Be specific with numbers when available.
- If the question is about stock levels, use the context provided above.
- Never make up inventory data that is not in the context.
- If the question is unclear, ask one short clarifying question instead of guessing.`
}
