import { CRITICAL_STOCK_THRESHOLD, DISPLAY_DECIMAL_PLACES } from '@/lib/constants'

/**
 * Formats a stock quantity for display.
 * - Caps at DISPLAY_DECIMAL_PLACES decimal places
 * - Strips trailing zeros (340.00 → "340", 12.40 → "12.4")
 * - Appends the unit with a space ("340 g", "12.4 kg", "840 tabs")
 */
export function formatQuantity(qty: number, unit: string): string {
  const fixed = qty.toFixed(DISPLAY_DECIMAL_PLACES)
  // Remove trailing zeros after the decimal point, then remove a trailing dot
  const trimmed = fixed.replace(/(\.\d*?)0+$/, '$1').replace(/\.$/, '')
  return `${trimmed} ${unit}`
}

/**
 * Returns a Tailwind text color class based on how current stock compares
 * to the item's reorder point.
 *
 * zero   → 'text-red-600 font-bold'
 * critical (≤ reorderPoint × CRITICAL_STOCK_THRESHOLD) → 'text-red-600'
 * low    (≤ reorderPoint) → 'text-tertiary'
 * ok     (> reorderPoint) → 'text-on-surface'
 */
export function getStockColor(current: number, reorderPoint: number): string {
  if (current === 0) {
    return 'text-red-600 font-bold'
  }
  if (reorderPoint > 0 && current <= reorderPoint * CRITICAL_STOCK_THRESHOLD) {
    return 'text-red-600'
  }
  if (current <= reorderPoint) {
    return 'text-tertiary'
  }
  return 'text-on-surface'
}
