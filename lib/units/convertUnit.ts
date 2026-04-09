import 'server-only'
import { createServerClient } from '@/lib/supabase/server'
import { UnitConversionNotFoundError } from '@/lib/recipes/errors'
import { STOCK_DECIMAL_PLACES } from '@/lib/constants'

/**
 * Returns the multiplier to convert from_unit → to_unit.
 * Returns 1 if from_unit === to_unit (no conversion needed).
 * Throws UnitConversionNotFoundError if the pair is absent from unit_conversions.
 */
export async function getUnitMultiplier(
  from_unit: string,
  to_unit: string,
): Promise<number> {
  if (from_unit === to_unit) return 1

  const supabase = await createServerClient()
  const { data, error } = await supabase
    .from('unit_conversions')
    .select('multiplier')
    .eq('from_unit', from_unit)
    .eq('to_unit', to_unit)
    .single()

  if (error || data === null) {
    throw new UnitConversionNotFoundError(from_unit, to_unit)
  }

  return Number(data.multiplier)
}

/**
 * Multiplies quantity by multiplier and rounds to STOCK_DECIMAL_PLACES (4)
 * to avoid floating-point drift in stored values.
 */
export function convertQuantity(quantity: number, multiplier: number): number {
  return Number((quantity * multiplier).toFixed(STOCK_DECIMAL_PLACES))
}
