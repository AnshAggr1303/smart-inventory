// lib/utils/unitAliases.ts

export const UNIT_ALIASES: Record<string, string> = {
  // Weight
  'kg': 'kg',
  'kgs': 'kg',
  'kgs.': 'kg',
  'kilogram': 'kg',
  'kilograms': 'kg',
  'kilo': 'kg',
  'g': 'g',
  'gm': 'g',
  'gms': 'g',
  'gram': 'g',
  'grams': 'g',
  // Volume
  'l': 'l',
  'ltr': 'l',
  'ltrs': 'l',
  'litre': 'l',
  'litres': 'l',
  'liter': 'l',
  'liters': 'l',
  'ml': 'ml',
  'mls': 'ml',
  'millilitre': 'ml',
  'millilitres': 'ml',
  'milliliter': 'ml',
  'milliliters': 'ml',
  // Pieces
  'pcs': 'pcs',
  'pc': 'pcs',
  'piece': 'pcs',
  'pieces': 'pcs',
  'nos': 'pcs',
  'no': 'pcs',
  'number': 'pcs',
  // Medicine
  'tabs': 'tabs',
  'tab': 'tabs',
  'tablet': 'tabs',
  'tablets': 'tabs',
  'strips': 'strips',
  'strip': 'strips',
  // Packaging
  'pkt': 'pkt',
  'pkts': 'pkt',
  'packet': 'pkt',
  'packets': 'pkt',
  'box': 'box',
  'boxes': 'box',
  'bxs': 'box',
  'dozen': 'dozen',
  'doz': 'dozen',
  'dz': 'dozen',
}

/**
 * Normalises a raw unit string to a canonical form.
 * Returns the original (lowercased + trimmed) if no alias is found.
 */
export function normaliseUnit(raw: string): string {
  const key = raw.toLowerCase().trim()
  return UNIT_ALIASES[key] ?? key
}
