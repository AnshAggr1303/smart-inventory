# Suppliers & Settings Pages Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the suppliers list/add page and the three-section settings page so both sidebar links have working content.

**Architecture:** Server Components fetch all data server-side and pass typed props to small Client Component islands for interactivity (modals, forms, sign-out). All mutations go through `'use server'` actions validated with Zod. API keys are stored as `JSON.stringify([encryptedKey1, ...])` in `user_settings.groq_keys`; blank key fields on update preserve the existing encrypted value.

**Tech Stack:** Next.js 14 App Router, TypeScript (strict), Tailwind, Supabase, Zod, `encryptKey`/`decryptKey` from `@/lib/crypto/encryptKey`, `date-fns`, `lucide-react`, `react-hot-toast`

---

## File Map

**Create:**
- `app/(app)/suppliers/loading.tsx`
- `app/(app)/suppliers/error.tsx`
- `app/(app)/suppliers/actions.ts`
- `app/(app)/suppliers/AddSupplierModal.tsx`
- `app/(app)/suppliers/page.tsx`
- `app/(app)/settings/loading.tsx`
- `app/(app)/settings/error.tsx`
- `app/(app)/settings/actions.ts`
- `app/(app)/settings/OrgSection.tsx`
- `app/(app)/settings/ApiKeysSection.tsx`
- `app/(app)/settings/AccountSection.tsx`
- `app/(app)/settings/page.tsx`

**No existing files need modification.**

---

## Task 1: Suppliers — loading.tsx + error.tsx

**Files:**
- Create: `app/(app)/suppliers/loading.tsx`
- Create: `app/(app)/suppliers/error.tsx`

- [ ] **Step 1: Create `app/(app)/suppliers/loading.tsx`**

```tsx
export default function SuppliersLoading() {
  return (
    <div className="max-w-7xl mx-auto space-y-6">
      <div className="space-y-1">
        <div className="h-7 w-28 bg-surface-container rounded-lg animate-pulse" />
        <div className="h-4 w-56 bg-surface-container rounded animate-pulse" />
      </div>
      <div
        className="bg-surface-lowest rounded-2xl overflow-hidden"
        style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
      >
        <div className="bg-surface-low px-6 py-3 flex gap-8">
          {['w-24', 'w-20', 'w-32', 'w-16'].map((w, i) => (
            <div key={i} className={`h-3 ${w} bg-surface-container rounded animate-pulse`} />
          ))}
        </div>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="px-6 py-4 border-t border-outline-variant/10 flex gap-8">
            <div className="h-4 w-32 bg-surface-container rounded animate-pulse" />
            <div className="h-4 w-24 bg-surface-container rounded animate-pulse" />
            <div className="h-4 w-40 bg-surface-container rounded animate-pulse" />
            <div className="h-4 w-20 bg-surface-container rounded animate-pulse" />
          </div>
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(app)/suppliers/error.tsx`**

```tsx
'use client'

import { AlertCircle } from 'lucide-react'

export default function SuppliersError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="max-w-7xl mx-auto flex items-center justify-center py-24">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-on-surface">Suppliers unavailable</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Could not load suppliers. Try refreshing.
          </p>
        </div>
        <button
          onClick={reset}
          className="w-full gradient-primary text-on-primary font-bold text-sm py-3 rounded-lg hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
        {error.digest && (
          <p className="font-mono text-[10px] text-on-surface-variant/40">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/suppliers/loading.tsx app/\(app\)/suppliers/error.tsx
git commit -m "feat: add suppliers loading and error boundaries"
```

---

## Task 2: Suppliers — actions.ts

**Files:**
- Create: `app/(app)/suppliers/actions.ts`

- [ ] **Step 1: Create `app/(app)/suppliers/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'

// ── Schema ─────────────────────────────────────────────────

const CreateSupplierSchema = z.object({
  name: z.string().min(1, 'Supplier name is required').max(200),
  phone: z.string().max(30).optional(),
  email: z
    .string()
    .email('Enter a valid email address')
    .optional()
    .or(z.literal('')),
  address: z.string().max(500).optional(),
})

// ── Helpers ────────────────────────────────────────────────

async function getOrgId(
  supabase: Awaited<ReturnType<typeof createServerClient>>,
  userId: string
): Promise<string> {
  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', userId)
    .single()
  if (!profile?.org_id) redirect('/onboarding/step-2')
  return profile.org_id
}

// ── Action ─────────────────────────────────────────────────

export async function createSupplierAction(
  _prevState: { success: true } | { success: false; error: string } | null,
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const org_id = await getOrgId(supabase, user.id)

  const raw = {
    name: formData.get('name'),
    phone: formData.get('phone') || undefined,
    email: formData.get('email') || undefined,
    address: formData.get('address') || undefined,
  }

  const parsed = CreateSupplierSchema.safeParse(raw)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Invalid input',
    }
  }

  const { error } = await supabase.from('suppliers').insert({
    org_id,
    name: parsed.data.name,
    phone: parsed.data.phone ?? null,
    email: parsed.data.email || null,
    address: parsed.data.address ?? null,
  })

  if (error) {
    console.error(
      JSON.stringify({
        event: 'create_supplier_error',
        message: error.message,
        timestamp: new Date().toISOString(),
      })
    )
    return { success: false, error: 'Failed to add supplier. Please try again.' }
  }

  revalidatePath('/suppliers')
  return { success: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/suppliers/actions.ts
git commit -m "feat: add createSupplierAction server action"
```

---

## Task 3: Suppliers — AddSupplierModal.tsx

**Files:**
- Create: `app/(app)/suppliers/AddSupplierModal.tsx`

- [ ] **Step 1: Create `app/(app)/suppliers/AddSupplierModal.tsx`**

```tsx
'use client'
// Client component: needs useState for modal open/close and useActionState for action result

import { useEffect, useActionState } from 'react'
import { X, Plus } from 'lucide-react'
import toast from 'react-hot-toast'
import { createSupplierAction } from '@/app/(app)/suppliers/actions'

type AddSupplierModalProps = {
  isOpen: boolean
  onClose: () => void
}

export default function AddSupplierModal({ isOpen, onClose }: AddSupplierModalProps) {
  const [state, formAction, isPending] = useActionState(createSupplierAction, null)

  useEffect(() => {
    if (state?.success) {
      toast.success('Supplier added')
      onClose()
    }
  }, [state, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-on-surface/20 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div
        className="relative bg-surface-lowest rounded-2xl w-full max-w-lg p-6"
        style={{ boxShadow: '0 12px 32px -4px rgba(27, 28, 22, 0.06)' }}
      >
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-heading-md font-semibold text-on-surface">Add Supplier</h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-surface transition-colors text-on-surface-variant"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {state && !state.success && (
          <div className="mb-4 px-4 py-3 rounded-lg bg-error-container text-on-error-container text-body-sm">
            {state.error}
          </div>
        )}

        <form action={formAction} className="space-y-4">
          <div>
            <label className="block text-body-sm text-on-surface-variant mb-1">
              Supplier name *
            </label>
            <input
              name="name"
              required
              className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed"
              placeholder="e.g. Fresh Farms Co."
            />
          </div>

          <div>
            <label className="block text-body-sm text-on-surface-variant mb-1">Phone</label>
            <input
              name="phone"
              type="tel"
              className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed"
              placeholder="+91 98765 43210"
            />
          </div>

          <div>
            <label className="block text-body-sm text-on-surface-variant mb-1">Email</label>
            <input
              name="email"
              type="email"
              className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed"
              placeholder="supplier@example.com"
            />
          </div>

          <div>
            <label className="block text-body-sm text-on-surface-variant mb-1">Address</label>
            <textarea
              name="address"
              rows={2}
              className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed resize-none"
              placeholder="Street, city, state"
            />
          </div>

          <div className="flex gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 bg-surface-lowest rounded-lg text-body-md font-medium text-on-surface border border-outline-variant/15 hover:bg-surface transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="flex-1 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold flex items-center justify-center gap-2 disabled:opacity-60 hover:-translate-y-px transition-transform"
            >
              <Plus className="w-4 h-4" />
              {isPending ? 'Adding…' : 'Add Supplier'}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/suppliers/AddSupplierModal.tsx
git commit -m "feat: add AddSupplierModal client component"
```

---

## Task 4: Suppliers — page.tsx

**Files:**
- Create: `app/(app)/suppliers/page.tsx`

- [ ] **Step 1: Create `app/(app)/suppliers/page.tsx`**

```tsx
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { format } from 'date-fns'
import { Truck } from 'lucide-react'
import AddSupplierModal from '@/app/(app)/suppliers/AddSupplierModal'
import SuppliersTableClient from '@/app/(app)/suppliers/SuppliersTableClient'

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
    .select('id, name, phone, email, address, created_at')
    .eq('org_id', org_id)
    .order('name')

  const suppliers = (rawSuppliers ?? []).map((s) => ({
    ...s,
    added: format(new Date(s.created_at), 'dd MMM yyyy'),
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
        <SuppliersTableClient suppliers={suppliers} />
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
```

**Note:** The "Add supplier" button and modal need to live in a Client Component island since they use `useState`. Create `SuppliersTableClient.tsx` alongside page.tsx:

- [ ] **Step 2: Create `app/(app)/suppliers/SuppliersTableClient.tsx`**

```tsx
'use client'
// Client component: needs useState to control modal open/close

import { useState } from 'react'
import { Plus } from 'lucide-react'
import AddSupplierModal from '@/app/(app)/suppliers/AddSupplierModal'

type SuppliersTableClientProps = {
  suppliers: unknown[]
}

export default function SuppliersTableClient({ suppliers }: SuppliersTableClientProps) {
  const [isModalOpen, setIsModalOpen] = useState(false)

  // suppliers prop unused here — this component only controls the Add button.
  // Passed to allow future use without prop-drilling through server component.
  void suppliers

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold hover:-translate-y-px transition-transform"
      >
        <Plus className="w-4 h-4" />
        Add supplier
      </button>
      <AddSupplierModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}
```

**Wait** — re-read: the page renders the table itself (Server Component), and `SuppliersTableClient` only owns the Add button + modal. That is intentional — the table data is static server-rendered, and after `createSupplierAction` calls `revalidatePath('/suppliers')` Next.js will re-render the page.

Update `page.tsx` — the `SuppliersTableClient` import only needs the button, so remove `suppliers` from the prop:

- [ ] **Step 3: Simplify `SuppliersTableClient.tsx`**

Replace the file with this cleaner version (no unused prop):

```tsx
'use client'
// Client component: needs useState to control modal open/close

import { useState } from 'react'
import { Plus } from 'lucide-react'
import AddSupplierModal from '@/app/(app)/suppliers/AddSupplierModal'

export default function AddSupplierButton() {
  const [isModalOpen, setIsModalOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setIsModalOpen(true)}
        className="flex items-center gap-2 px-4 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold hover:-translate-y-px transition-transform"
      >
        <Plus className="w-4 h-4" />
        Add supplier
      </button>
      <AddSupplierModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </>
  )
}
```

Rename the file to `AddSupplierButton.tsx` and update the import in `page.tsx`:

- `app/(app)/suppliers/SuppliersTableClient.tsx` → `app/(app)/suppliers/AddSupplierButton.tsx`
- In `page.tsx`: change `import SuppliersTableClient` → `import AddSupplierButton` and `<SuppliersTableClient suppliers={suppliers} />` → `<AddSupplierButton />`

Final `page.tsx` header section:

```tsx
import AddSupplierButton from '@/app/(app)/suppliers/AddSupplierButton'
// ... rest unchanged, replace <SuppliersTableClient suppliers={suppliers} /> with <AddSupplierButton />
```

- [ ] **Step 4: Commit**

```bash
git add app/\(app\)/suppliers/page.tsx app/\(app\)/suppliers/AddSupplierButton.tsx
git commit -m "feat: add suppliers page with table and add-supplier button"
```

---

## Task 5: Settings — loading.tsx + error.tsx

**Files:**
- Create: `app/(app)/settings/loading.tsx`
- Create: `app/(app)/settings/error.tsx`

- [ ] **Step 1: Create `app/(app)/settings/loading.tsx`**

```tsx
export default function SettingsLoading() {
  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="h-7 w-20 bg-surface-container rounded-lg animate-pulse" />
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="bg-surface-lowest rounded-2xl p-6 space-y-4"
          style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
        >
          <div className="h-3 w-24 bg-surface-container rounded animate-pulse" />
          <div className="h-10 w-full bg-surface-container rounded-lg animate-pulse" />
          <div className="h-10 w-full bg-surface-container rounded-lg animate-pulse" />
          <div className="h-10 w-24 bg-surface-container rounded-lg animate-pulse" />
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Create `app/(app)/settings/error.tsx`**

```tsx
'use client'

import { AlertCircle } from 'lucide-react'

export default function SettingsError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="max-w-2xl mx-auto flex items-center justify-center py-24">
      <div className="text-center space-y-6 max-w-sm">
        <div className="w-16 h-16 rounded-2xl bg-error/10 flex items-center justify-center mx-auto">
          <AlertCircle className="w-8 h-8 text-error" />
        </div>
        <div className="space-y-2">
          <h2 className="text-xl font-bold text-on-surface">Settings unavailable</h2>
          <p className="text-sm text-on-surface-variant leading-relaxed">
            Could not load your settings. Try refreshing.
          </p>
        </div>
        <button
          onClick={reset}
          className="w-full gradient-primary text-on-primary font-bold text-sm py-3 rounded-lg hover:opacity-90 transition-opacity"
        >
          Try again
        </button>
        {error.digest && (
          <p className="font-mono text-[10px] text-on-surface-variant/40">
            Error ID: {error.digest}
          </p>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add app/\(app\)/settings/loading.tsx app/\(app\)/settings/error.tsx
git commit -m "feat: add settings loading and error boundaries"
```

---

## Task 6: Settings — actions.ts

**Files:**
- Create: `app/(app)/settings/actions.ts`

**Key schema facts:**
- `user_settings.groq_keys` = `JSON.stringify([encryptedKey1, encryptedKey2, encryptedKey3])` — an array of up to 3 encrypted strings
- `user_settings.gemini_key` = single encrypted string or null
- Blank field on update = keep existing encrypted value; never overwrite with null

- [ ] **Step 1: Create `app/(app)/settings/actions.ts`**

```ts
'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { encryptKey, decryptKey } from '@/lib/crypto/encryptKey'
import { INDUSTRIES } from '@/lib/constants'

// ── Helpers ────────────────────────────────────────────────

async function getSessionAndOrg(supabase: Awaited<ReturnType<typeof createServerClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { user: null, org_id: null }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  return { user, org_id: profile?.org_id ?? null }
}

// ── 1. Update organisation ─────────────────────────────────

const UpdateOrgSchema = z.object({
  name: z.string().min(1, 'Organisation name is required').max(200),
  industry: z.enum(INDUSTRIES as unknown as [string, ...string[]], {
    error: 'Please select a valid industry',
  }),
})

export async function updateOrgAction(
  _prevState: { success: true } | { success: false; error: string } | null,
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerClient()
  const { user, org_id } = await getSessionAndOrg(supabase)
  if (!user || !org_id) return { success: false, error: 'Not authenticated' }

  const parsed = UpdateOrgSchema.safeParse({
    name: formData.get('name'),
    industry: formData.get('industry'),
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { error } = await supabase
    .from('organisations')
    .update({ name: parsed.data.name, industry: parsed.data.industry })
    .eq('id', org_id)

  if (error) {
    return { success: false, error: 'Failed to save organisation. Please try again.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

// ── 2. Update profile (display name) ──────────────────────

const UpdateProfileSchema = z.object({
  full_name: z.string().max(100).optional(),
})

export async function updateProfileAction(
  _prevState: { success: true } | { success: false; error: string } | null,
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { success: false, error: 'Not authenticated' }

  const parsed = UpdateProfileSchema.safeParse({
    full_name: formData.get('full_name') || undefined,
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const { error } = await supabase
    .from('user_profiles')
    .update({ full_name: parsed.data.full_name ?? null })
    .eq('id', user.id)

  if (error) {
    return { success: false, error: 'Failed to save display name. Please try again.' }
  }

  revalidatePath('/settings')
  return { success: true }
}

// ── 3. Update API keys (partial — blank = keep existing) ──

const KeyFieldSchema = z
  .string()
  .optional()
  .transform((v) => (v && v.trim().length > 0 ? v.trim() : undefined))

const UpdateApiKeysSchema = z.object({
  groq_key_1: KeyFieldSchema,
  groq_key_2: KeyFieldSchema,
  groq_key_3: KeyFieldSchema,
  gemini_key: KeyFieldSchema,
})

export async function updateApiKeysAction(
  _prevState: { success: true } | { success: false; error: string } | null,
  formData: FormData
): Promise<{ success: true } | { success: false; error: string }> {
  const supabase = await createServerClient()
  const { user, org_id } = await getSessionAndOrg(supabase)
  if (!user || !org_id) return { success: false, error: 'Not authenticated' }

  const parsed = UpdateApiKeysSchema.safeParse({
    groq_key_1: formData.get('groq_key_1'),
    groq_key_2: formData.get('groq_key_2'),
    groq_key_3: formData.get('groq_key_3'),
    gemini_key: formData.get('gemini_key'),
  })
  if (!parsed.success) {
    return { success: false, error: parsed.error.issues[0]?.message ?? 'Invalid input' }
  }

  const newKeys = parsed.data

  // Validate prefix format for any provided keys
  const prefixErrors: string[] = []
  if (newKeys.groq_key_1 && !newKeys.groq_key_1.startsWith('gsk_'))
    prefixErrors.push('Groq Key 1 must start with gsk_')
  if (newKeys.groq_key_2 && !newKeys.groq_key_2.startsWith('gsk_'))
    prefixErrors.push('Groq Key 2 must start with gsk_')
  if (newKeys.groq_key_3 && !newKeys.groq_key_3.startsWith('gsk_'))
    prefixErrors.push('Groq Key 3 must start with gsk_')
  if (newKeys.gemini_key && !newKeys.gemini_key.startsWith('AIza'))
    prefixErrors.push('Gemini key must start with AIza')
  if (prefixErrors.length > 0) {
    return { success: false, error: prefixErrors[0]! }
  }

  // Fetch existing encrypted keys
  const { data: existingSettings } = await supabase
    .from('user_settings')
    .select('groq_keys, gemini_key')
    .eq('user_id', user.id)
    .single()

  // Merge Groq keys: decrypt existing array, replace slots that have a new value
  let existingGroqEncArr: (string | null)[] = [null, null, null]
  if (existingSettings?.groq_keys) {
    try {
      existingGroqEncArr = JSON.parse(existingSettings.groq_keys) as (string | null)[]
    } catch {
      // malformed — start fresh
    }
  }

  const newGroqPlain = [newKeys.groq_key_1, newKeys.groq_key_2, newKeys.groq_key_3]
  const mergedGroqEnc = newGroqPlain.map((newKey, i) => {
    if (newKey) return encryptKey(newKey)
    return existingGroqEncArr[i] ?? null
  })

  // Filter nulls — only store keys that exist
  const finalGroqEnc = mergedGroqEnc.filter((k): k is string => k !== null)

  // Merge Gemini key
  const finalGeminiEnc = newKeys.gemini_key
    ? encryptKey(newKeys.gemini_key)
    : (existingSettings?.gemini_key ?? null)

  const { error } = await supabase.from('user_settings').upsert(
    {
      user_id: user.id,
      org_id,
      groq_keys: JSON.stringify(finalGroqEnc),
      gemini_key: finalGeminiEnc,
    },
    { onConflict: 'user_id' }
  )

  if (error) {
    return { success: false, error: 'Failed to save API keys. Please try again.' }
  }

  revalidatePath('/settings')
  return { success: true }
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/settings/actions.ts
git commit -m "feat: add settings server actions (org, profile, api keys)"
```

---

## Task 7: Settings — OrgSection.tsx

**Files:**
- Create: `app/(app)/settings/OrgSection.tsx`

- [ ] **Step 1: Create `app/(app)/settings/OrgSection.tsx`**

```tsx
'use client'
// Client component: needs useActionState for form submission feedback

import { useActionState } from 'react'
import toast from 'react-hot-toast'
import { useEffect } from 'react'
import { updateOrgAction } from '@/app/(app)/settings/actions'
import { INDUSTRIES } from '@/lib/constants'

const INDUSTRY_LABELS: Record<(typeof INDUSTRIES)[number], string> = {
  restaurant: 'Restaurant',
  pharmacy: 'Pharmacy',
  retail: 'Retail',
  hotel: 'Hotel',
  manufacturing: 'Manufacturing',
  other: 'Other',
}

type OrgSectionProps = {
  name: string
  industry: string
}

export default function OrgSection({ name, industry }: OrgSectionProps) {
  const [state, formAction, isPending] = useActionState(updateOrgAction, null)

  useEffect(() => {
    if (state?.success) toast.success('Organisation saved')
  }, [state])

  return (
    <div
      className="bg-surface-lowest rounded-2xl p-6"
      style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-5">
        Organisation
      </p>

      {state && !state.success && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-error-container text-on-error-container text-body-sm">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-body-sm text-on-surface-variant mb-1">
            Business name
          </label>
          <input
            name="name"
            required
            defaultValue={name}
            className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed"
          />
        </div>

        <div>
          <label className="block text-body-sm text-on-surface-variant mb-1">Industry</label>
          <select
            name="industry"
            defaultValue={industry}
            className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed"
          >
            {INDUSTRIES.map((ind) => (
              <option key={ind} value={ind}>
                {INDUSTRY_LABELS[ind]}
              </option>
            ))}
          </select>
        </div>

        <button
          type="submit"
          disabled={isPending}
          className="px-5 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold disabled:opacity-60 hover:-translate-y-px transition-transform"
        >
          {isPending ? 'Saving…' : 'Save'}
        </button>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/settings/OrgSection.tsx
git commit -m "feat: add OrgSection settings component"
```

---

## Task 8: Settings — ApiKeysSection.tsx

**Files:**
- Create: `app/(app)/settings/ApiKeysSection.tsx`

Key masking is computed server-side and passed as props. Each prop is either the last-4 chars of the decrypted key or `null` (not set).

- [ ] **Step 1: Create `app/(app)/settings/ApiKeysSection.tsx`**

```tsx
'use client'
// Client component: needs useState to toggle inline key-update form and useActionState for submission

import { useState, useEffect, useActionState } from 'react'
import { KeyRound, ChevronDown, ChevronUp } from 'lucide-react'
import toast from 'react-hot-toast'
import { updateApiKeysAction } from '@/app/(app)/settings/actions'

type ApiKeysSectionProps = {
  groqLast4: [string | null, string | null, string | null]
  geminiLast4: string | null
}

const INPUT_CLASS =
  'w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed font-mono'

export default function ApiKeysSection({ groqLast4, geminiLast4 }: ApiKeysSectionProps) {
  const [showForm, setShowForm] = useState(false)
  const [state, formAction, isPending] = useActionState(updateApiKeysAction, null)

  useEffect(() => {
    if (state?.success) {
      toast.success('API keys updated')
      setShowForm(false)
    }
  }, [state])

  const keyRows: { label: string; last4: string | null }[] = [
    { label: 'Groq Key 1', last4: groqLast4[0] },
    { label: 'Groq Key 2', last4: groqLast4[1] },
    { label: 'Groq Key 3', last4: groqLast4[2] },
    { label: 'Gemini Key', last4: geminiLast4 },
  ]

  return (
    <div
      className="bg-surface-lowest rounded-2xl p-6"
      style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-5">
        API Keys
      </p>

      {/* Masked key display */}
      <div className="space-y-3 mb-5">
        {keyRows.map(({ label, last4 }) => (
          <div key={label} className="flex items-center justify-between">
            <span className="text-body-md text-on-surface-variant">{label}</span>
            {last4 ? (
              <span className="font-mono text-body-sm text-on-surface bg-surface px-2.5 py-1 rounded-lg">
                •••• {last4}
              </span>
            ) : (
              <span className="text-body-sm text-on-surface-variant/50 italic">Not set</span>
            )}
          </div>
        ))}
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setShowForm((v) => !v)}
        className="flex items-center gap-2 text-body-sm font-medium text-primary hover:opacity-80 transition-opacity"
      >
        <KeyRound className="w-4 h-4" />
        {showForm ? 'Cancel' : 'Update keys'}
        {showForm ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
      </button>

      {/* Inline form */}
      {showForm && (
        <div className="mt-5 pt-5 border-t border-outline-variant/10">
          {state && !state.success && (
            <div className="mb-4 px-4 py-3 rounded-lg bg-error-container text-on-error-container text-body-sm">
              {state.error}
            </div>
          )}

          <form action={formAction} className="space-y-4">
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">
                Groq Key 1
              </label>
              <input
                name="groq_key_1"
                className={INPUT_CLASS}
                placeholder="gsk_ … leave blank to keep existing"
              />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">
                Groq Key 2
              </label>
              <input
                name="groq_key_2"
                className={INPUT_CLASS}
                placeholder="gsk_ … leave blank to keep existing"
              />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">
                Groq Key 3
              </label>
              <input
                name="groq_key_3"
                className={INPUT_CLASS}
                placeholder="gsk_ … leave blank to keep existing"
              />
            </div>
            <div>
              <label className="block text-body-sm text-on-surface-variant mb-1">
                Gemini Key
              </label>
              <input
                name="gemini_key"
                className={INPUT_CLASS}
                placeholder="AIza … leave blank to keep existing"
              />
            </div>

            <div className="flex gap-3 pt-1">
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 bg-surface-lowest rounded-lg text-body-md font-medium text-on-surface border border-outline-variant/15 hover:bg-surface transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={isPending}
                className="px-5 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold disabled:opacity-60 hover:-translate-y-px transition-transform"
              >
                {isPending ? 'Saving…' : 'Save keys'}
              </button>
            </div>
          </form>

          <p className="text-body-sm text-on-surface-variant/60 mt-4 flex items-center gap-1.5">
            <KeyRound className="w-3.5 h-3.5" />
            Keys are encrypted with AES-256-GCM before storage.
          </p>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/settings/ApiKeysSection.tsx
git commit -m "feat: add ApiKeysSection settings component"
```

---

## Task 9: Settings — AccountSection.tsx

**Files:**
- Create: `app/(app)/settings/AccountSection.tsx`

- [ ] **Step 1: Create `app/(app)/settings/AccountSection.tsx`**

```tsx
'use client'
// Client component: needs useActionState for profile save and router.push for sign-out redirect

import { useEffect, useActionState } from 'react'
import { useRouter } from 'next/navigation'
import toast from 'react-hot-toast'
import { updateProfileAction } from '@/app/(app)/settings/actions'
import { createClient } from '@/lib/supabase/client'

type AccountSectionProps = {
  email: string
  fullName: string | null
}

export default function AccountSection({ email, fullName }: AccountSectionProps) {
  const router = useRouter()
  const [state, formAction, isPending] = useActionState(updateProfileAction, null)

  useEffect(() => {
    if (state?.success) toast.success('Account saved')
  }, [state])

  async function handleSignOut() {
    const supabase = createClient()
    await supabase.auth.signOut()
    router.push('/login')
  }

  return (
    <div
      className="bg-surface-lowest rounded-2xl p-6"
      style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
    >
      <p className="text-[10px] uppercase tracking-wider font-semibold text-on-surface-variant mb-5">
        Account
      </p>

      {state && !state.success && (
        <div className="mb-4 px-4 py-3 rounded-lg bg-error-container text-on-error-container text-body-sm">
          {state.error}
        </div>
      )}

      <form action={formAction} className="space-y-4">
        <div>
          <label className="block text-body-sm text-on-surface-variant mb-1">Email</label>
          <input
            value={email}
            disabled
            className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface-variant cursor-not-allowed opacity-60"
            readOnly
          />
        </div>

        <div>
          <label className="block text-body-sm text-on-surface-variant mb-1">
            Display name
          </label>
          <input
            name="full_name"
            defaultValue={fullName ?? ''}
            className="w-full px-3 py-2 bg-surface rounded-lg text-body-md text-on-surface focus:outline-none focus:ring-2 focus:ring-primary-fixed"
            placeholder="Your name"
          />
        </div>

        <div className="flex items-center gap-3 pt-1">
          <button
            type="submit"
            disabled={isPending}
            className="px-5 py-2.5 gradient-primary text-on-primary rounded-lg text-body-md font-semibold disabled:opacity-60 hover:-translate-y-px transition-transform"
          >
            {isPending ? 'Saving…' : 'Save'}
          </button>

          <button
            type="button"
            onClick={handleSignOut}
            className="px-5 py-2.5 bg-surface-lowest rounded-lg text-body-md font-medium text-on-surface-variant border border-outline-variant/15 hover:bg-surface transition-colors"
          >
            Sign out
          </button>
        </div>
      </form>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/settings/AccountSection.tsx
git commit -m "feat: add AccountSection settings component"
```

---

## Task 10: Settings — page.tsx

**Files:**
- Create: `app/(app)/settings/page.tsx`

The page decrypts `groq_keys` server-side and extracts only the last-4 chars of each key to pass to `ApiKeysSection`. Full decrypted keys are never sent to the client.

- [ ] **Step 1: Create `app/(app)/settings/page.tsx`**

```tsx
import { createServerClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { decryptKey } from '@/lib/crypto/encryptKey'
import OrgSection from '@/app/(app)/settings/OrgSection'
import ApiKeysSection from '@/app/(app)/settings/ApiKeysSection'
import AccountSection from '@/app/(app)/settings/AccountSection'

function last4(encrypted: string | null | undefined): string | null {
  if (!encrypted) return null
  try {
    const plain = decryptKey(encrypted)
    return plain.slice(-4)
  } catch {
    return null
  }
}

export default async function SettingsPage() {
  const supabase = await createServerClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id, full_name')
    .eq('id', user.id)
    .single()
  if (!profile?.org_id) redirect('/onboarding/step-2')
  const org_id = profile.org_id

  const [orgResult, settingsResult] = await Promise.all([
    supabase
      .from('organisations')
      .select('name, industry')
      .eq('id', org_id)
      .single(),
    supabase
      .from('user_settings')
      .select('groq_keys, gemini_key')
      .eq('user_id', user.id)
      .single(),
  ])

  const org = orgResult.data
  const settings = settingsResult.data

  // Decrypt groq_keys JSON array → extract last-4 per slot
  let groqEncArr: (string | null)[] = [null, null, null]
  if (settings?.groq_keys) {
    try {
      groqEncArr = JSON.parse(settings.groq_keys) as (string | null)[]
    } catch {
      // malformed — treat as empty
    }
  }

  const groqLast4: [string | null, string | null, string | null] = [
    last4(groqEncArr[0] ?? null),
    last4(groqEncArr[1] ?? null),
    last4(groqEncArr[2] ?? null),
  ]

  const geminiLast4 = last4(settings?.gemini_key ?? null)

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <h1 className="text-heading-md font-semibold text-on-surface">Settings</h1>

      <OrgSection
        name={org?.name ?? ''}
        industry={org?.industry ?? 'other'}
      />

      <ApiKeysSection
        groqLast4={groqLast4}
        geminiLast4={geminiLast4}
      />

      <AccountSection
        email={user.email ?? ''}
        fullName={profile.full_name ?? null}
      />
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add app/\(app\)/settings/page.tsx
git commit -m "feat: add settings page with org, api keys, and account sections"
```

---

## Task 11: Build verification

- [ ] **Step 1: Run the build**

```bash
npm run build
```

Expected: exits 0, no TypeScript errors, no "Module not found" errors.

If you see a TypeScript error, read the exact line and type-narrow accordingly. Common causes:
- `profile.full_name` might be typed as `string | null` — already handled
- `groqEncArr` indexing — uses `?? null` fallback — already handled
- Supabase return types being `unknown[]` — cast with `as` if needed, never use `any`

- [ ] **Step 2: Commit build confirmation (no files to stage — note only)**

If the build passes cleanly, the implementation is complete. If there are type errors, fix them, then commit with:

```bash
git add <changed files>
git commit -m "fix: resolve TypeScript errors from build"
```

---

## Self-Review Against Spec

| Spec requirement | Task that covers it |
|---|---|
| Suppliers: fetch id, name, phone, email, address, created_at | Task 4 |
| Suppliers: table columns Name, Phone, Email, Added | Task 4 |
| Suppliers: empty state with Truck icon + description | Task 4 |
| Suppliers: Add supplier button | Task 4 (AddSupplierButton) |
| Suppliers: form fields name/phone/email/address | Task 3 |
| Suppliers: createSupplierAction with Zod | Task 2 |
| Settings: fetch org + profile + masked keys | Task 10 |
| Settings: OrgSection — name + industry select | Task 7 |
| Settings: industry options from INDUSTRIES constant | Task 7 |
| Settings: ApiKeysSection — masked display (last 4 chars) | Tasks 8, 10 |
| Settings: inline key update form, blank = keep existing | Tasks 6, 8 |
| Settings: never overwrite with null/empty | Task 6 (updateApiKeysAction merge logic) |
| Settings: prefix validation (gsk_, AIza) | Task 6 |
| Settings: AES-256 note in UI | Task 8 |
| Settings: AccountSection — email read-only | Task 9 |
| Settings: display name editable | Task 9 |
| Settings: sign out button | Task 9 |
| loading.tsx + error.tsx for both routes | Tasks 1, 5 |
| npm run build passes | Task 11 |
| Rules S1, S2, S6, S7, N1, N2, N4 | All tasks |
