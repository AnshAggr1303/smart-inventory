import { createServerClient } from '@/lib/supabase/server'
import type { Industry } from '@/types/index'

// Category seed data per industry — from docs/auth-onboarding.md
const INDUSTRY_CATEGORIES: Record<Industry, string[]> = {
  restaurant:    ['Dairy', 'Grains', 'Vegetables', 'Oils', 'Spices', 'Beverages'],
  pharmacy:      ['Tablets', 'Syrups', 'Injections', 'Surgical', 'OTC'],
  retail:        ['Electronics', 'Clothing', 'FMCG', 'Stationery'],
  hotel:         ['Linen', 'Toiletries', 'F&B', 'Minibar', 'Cleaning'],
  manufacturing: ['Raw Material', 'Packaging', 'Finished Goods', 'Consumables'],
  other:         [], // blank slate — user defines their own categories
}

const INDUSTRY_UNITS: Record<Industry, string[]> = {
  restaurant:    ['g', 'kg', 'ml', 'l', 'pcs'],
  pharmacy:      ['tabs', 'ml', 'vials', 'strips'],
  retail:        ['pcs', 'boxes', 'kg'],
  hotel:         ['pcs', 'ml', 'kg', 'sets'],
  manufacturing: ['kg', 'l', 'pcs', 'sheets'],
  other:         [],
}

/**
 * Seeds industry-specific default categories and unit preferences into the
 * organisation record immediately after the org is created in onboarding step 2.
 *
 * Wrapped in try/catch — failure must not block onboarding completion.
 */
export async function seedIndustryTemplates(
  org_id: string,
  industry: Industry
): Promise<void> {
  try {
    const supabase = await createServerClient()

    const categories = INDUSTRY_CATEGORIES[industry]
    const preferred_units = INDUSTRY_UNITS[industry]

    // Store template data on the organisation row.
    // The migration adds these two JSONB columns; if they don't exist yet the
    // update fails silently thanks to the outer try/catch.
    // Cast required because the supabase.ts placeholder uses an index signature
    // which, under noUncheckedIndexedAccess, resolves the Update type to
    // `Record<string, unknown> | undefined`. The real generated types will make
    // this cast unnecessary. See types/supabase.ts for regeneration instructions.
    const payload: Record<string, unknown> = { categories, preferred_units }
    const { error } = await supabase
      .from('organisations')
      .update(payload as never)
      .eq('id', org_id)

    if (error) {
      console.error('[seedIndustryTemplates] update failed:', {
        event: 'seed_industry_templates_failed',
        timestamp: new Date().toISOString(),
        success: false,
      })
    }
  } catch {
    // Failure here must never surface to the user or block onboarding.
    console.error('[seedIndustryTemplates] unexpected error', {
      event: 'seed_industry_templates_error',
      timestamp: new Date().toISOString(),
      success: false,
    })
  }
}
