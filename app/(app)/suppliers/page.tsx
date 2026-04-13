import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { Truck } from 'lucide-react'
import AddSupplierButton from '@/app/(app)/suppliers/AddSupplierButton'

export default async function SuppliersPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()
  if (!profile?.org_id) redirect('/onboarding/step-2')
  const org_id = profile.org_id

  const { data: rawSuppliers } = await supabase
    .from('suppliers')
    .select('id, name, phone, email, created_at')
    .eq('org_id', org_id)
    .order('name')

  const suppliers = (rawSuppliers ?? []).map((s) => ({
    ...s,
    added: s.created_at ? format(new Date(s.created_at), 'dd MMM yyyy') : '—',
  }))

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-heading-md font-semibold text-on-surface">Suppliers</h1>
          <p className="text-body-md text-on-surface-variant mt-1">
            All suppliers linked to your organisation.
          </p>
        </div>
        <AddSupplierButton />
      </div>

      {/* Table or empty state */}
      {suppliers.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 text-center">
          <Truck className="w-12 h-12 text-outline-variant mb-3" />
          <p className="text-body-md font-medium text-on-surface">No suppliers yet</p>
          <p className="text-body-sm text-on-surface-variant mt-1 max-w-xs">
            Suppliers are added automatically when you confirm a bill with a supplier
            name, or you can add one manually above.
          </p>
        </div>
      ) : (
        <div
          className="bg-surface-lowest rounded-2xl overflow-hidden"
          style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
        >
          <table className="w-full">
            <thead>
              <tr className="bg-surface-low">
                {['Name', 'Phone', 'Email', 'Added'].map((col) => (
                  <th
                    key={col}
                    className="px-6 py-3 text-left text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant"
                  >
                    {col}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {suppliers.map((s) => (
                <tr
                  key={s.id}
                  className="border-t border-outline-variant/10 hover:bg-surface-low/40 transition-colors"
                >
                  <td className="px-6 py-4 text-body-md font-medium text-on-surface">
                    {s.name}
                  </td>
                  <td className="px-6 py-4 text-body-md text-on-surface-variant">
                    {s.phone ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-body-md text-on-surface-variant">
                    {s.email ?? '—'}
                  </td>
                  <td className="px-6 py-4 text-body-sm font-mono text-on-surface-variant">
                    {s.added}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
