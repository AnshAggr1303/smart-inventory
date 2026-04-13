# Design Spec — Suppliers & Settings Pages
**Date:** 2026-04-12
**Status:** Approved

---

## Overview

Two sidebar pages currently have no content. This spec covers the design for both:

1. `app/(app)/suppliers/` — list + add suppliers
2. `app/(app)/settings/` — org, API keys, account management

Both pages follow **Approach A**: Server Component fetches all data, small Client Component islands handle interactivity. This matches the existing pattern in `analytics/page.tsx`, `inventory/page.tsx`, and `agents/page.tsx`.

---

## 1. Suppliers Page

### File layout

```
app/(app)/suppliers/
  page.tsx              Server Component — fetches, renders full page
  actions.ts            'use server' — createSupplierAction
  AddSupplierModal.tsx  'use client' — modal + form
  loading.tsx
  error.tsx
```

### Data fetch

`page.tsx` derives `org_id` from authenticated session (Rule S2), then:

```ts
supabase.from('suppliers')
  .select('id, name, phone, email, address, created_at')
  .eq('org_id', org_id)
  .order('name')
```

### Table layout

Columns: **Name | Phone | Email | Added** (formatted date).

- Card: `bg-surface-lowest rounded-2xl overflow-hidden` + ambient shadow
- Header row: `bg-surface-low`, uppercase label text, `text-on-surface-variant`
- Body rows: hover `bg-surface-low/40`, `border-outline-variant/10` separators (not 1px rule-breaking borders — these are within-table dividers via Tailwind)
- Phone / email shown as plain text; `—` if null
- Added: `format(created_at, 'dd MMM yyyy')` via date-fns

### Empty state

- Icon: `Truck` (48px), `text-outline-variant`
- Heading: "No suppliers yet"
- Subline: "Suppliers are added automatically when you confirm a bill with a supplier name"
- Action: "Add supplier" button (primary)

### Add Supplier modal

Same pattern as `AddItemModal.tsx`:

- Fixed overlay, `bg-on-surface/20 backdrop-blur-sm` backdrop
- `bg-surface-lowest rounded-2xl` modal panel, max-w-lg
- `useActionState(createSupplierAction, null)`
- Toast on success, close modal
- Fields:
  - Name (required, text)
  - Phone (optional, tel)
  - Email (optional, email)
  - Address (optional, textarea — 2 rows)
- Submit: "Add Supplier" primary button + spinner when `isPending`

### createSupplierAction

```ts
'use server'

const CreateSupplierSchema = z.object({
  name: z.string().min(1).max(200),
  phone: z.string().max(30).optional(),
  email: z.string().email().optional().or(z.literal('')),
  address: z.string().max(500).optional(),
})
```

- Derives `org_id` from session (Rule S2)
- Validates with Zod (Rule S7)
- Inserts into `suppliers` table
- `revalidatePath('/suppliers')`
- Returns `{ success: true }` or `{ success: false; error: string }`

---

## 2. Settings Page

### File layout

```
app/(app)/settings/
  page.tsx              Server Component — parallel fetches, renders three sections
  actions.ts            'use server' — updateOrgAction, updateProfileAction, updateApiKeysAction
  OrgSection.tsx        'use client' — org name + industry form
  ApiKeysSection.tsx    'use client' — masked key display + inline update form
  AccountSection.tsx    'use client' — display name form + sign-out
  loading.tsx
  error.tsx
```

### Server fetches (parallel)

```ts
const [orgResult, profileResult, settingsResult] = await Promise.all([
  supabase.from('organisations').select('name, industry').eq('id', org_id).single(),
  supabase.from('user_profiles').select('full_name').eq('id', user.id).single(),
  supabase.from('user_settings').select('groq_key_1_enc, groq_key_2_enc, groq_key_3_enc, gemini_key_enc').eq('org_id', org_id).single(),
])
```

Email comes from `supabase.auth.getUser()` — never from client (Rule S2).

### Page layout

Three stacked cards, each `bg-surface-lowest rounded-2xl p-6` + ambient shadow. Section labels as uppercase `text-[10px] tracking-wider` above each card.

---

### Section 1 — Organisation (`OrgSection.tsx`)

**Fields:**
- Org name: text input, pre-filled from DB
- Industry: `<select>` using `INDUSTRIES` constant from `/lib/constants.ts` — same options as onboarding step-2

**Action (`updateOrgAction`):**
```ts
const UpdateOrgSchema = z.object({
  name: z.string().min(1).max(200),
  industry: z.enum(INDUSTRIES),
})
```
Updates `organisations` table scoped to `org_id`. `revalidatePath('/settings')`.

---

### Section 2 — API Keys (`ApiKeysSection.tsx`)

**Display state (default):**

Four rows — Groq Key 1, Groq Key 2, Groq Key 3, Gemini Key. Each row:
- Label (e.g. "Groq Key 1")
- Masked value: `•••• ${last4}` derived server-side from decrypted key, or "Not set" badge
- "Note: Keys are encrypted with AES-256" shown as small footer text

Masking logic runs in `page.tsx` (server-side decrypt → last 4 chars only passed to client — never full key).

**"Update keys" button** — toggles inline form within the same card (no navigation away).

**Inline form (toggle state):**
- Same fields and prefix-validation as onboarding step-3: 3 Groq key inputs + 1 Gemini key input
- Placeholders: `gsk_...` / `AIza...`
- "Save keys" primary button + "Cancel" secondary button

**Action (`updateApiKeysAction`):**
- For each key field: if blank → skip (preserve existing encrypted value in DB); if non-empty → validate prefix (`gsk_` / `AIza`), re-encrypt, write
- Never overwrites a stored key with null or empty — partial updates are safe
- Uses `UPDATE ... SET col = CASE WHEN $new IS NOT NULL THEN $new ELSE col END` pattern, or equivalent selective upsert
- Returns `{ success: true }` or `{ success: false; error: string }`

---

### Section 3 — Account (`AccountSection.tsx`)

**Fields:**
- Email: read-only `<input disabled>` — sourced from auth, passed as prop
- Display name: text input, pre-filled from `user_profiles.full_name`

**Actions:**
- "Save" → `updateProfileAction`: updates `user_profiles.full_name` scoped to `user.id`. `revalidatePath('/settings')`.
- "Sign out" → client-side `supabase.auth.signOut()` then `router.push('/login')`. Confirm dialog not needed (non-destructive, reversible).

---

## Rules checklist

| Rule | Applied |
|------|---------|
| S1 — no keys to client | API keys decrypted server-side; only last-4 chars passed as props |
| S2 — org_id from session | All actions derive org_id from `supabase.auth.getUser()` |
| S6 — encrypt before storing | `updateApiKeysAction` re-encrypts with AES-256-GCM |
| S7 — Zod on all inputs | All three actions have Zod schemas |
| N1 — server components default | `page.tsx` is server; only interactive islands are client |
| N2 — server actions not API routes | All mutations via `'use server'` actions |
| N4 — loading + error | Both pages get `loading.tsx` and `error.tsx` |
| U1 — read DESIGN.md before UI | Followed: ambient shadows, no 1px borders, correct token usage |
| U3 — no 1px borders | Section separation via background color shifts only |
| U5 — quantities in mono | N/A for these pages |
| Q5 — no magic strings | Industry options from `INDUSTRIES` constant |

---

## Out of scope

- Supplier edit / delete (Phase 2)
- Pagination on suppliers table
- Notification preferences in settings (Phase 2)
- Team / multi-user settings (Phase 2)
