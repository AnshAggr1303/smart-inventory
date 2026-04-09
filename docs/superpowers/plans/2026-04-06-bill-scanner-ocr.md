# Bill Scanner + OCR Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a 4-stage bill scanner that converts a photo of a purchase invoice into confirmed stock transactions via client-side preprocessing, Gemini vision extraction, Groq item normalisation, and an atomic DB write.

**Architecture:** The client preprocesses + OCR-scans the image in-browser, then POSTs the base64 image to `/api/ocr/extract` (Gemini vision → item normalisation). The user reviews an editable table and clicks Confirm, which POSTs to `/api/ocr/confirm` (calls a Postgres RPC that atomically creates the bill, any new items, and all transactions). Four UI states (idle → processing → confirming → success) are managed by a `useState` state machine in the scanner page.

**Tech Stack:** Next.js 14 App Router, TypeScript strict, Tailwind, Supabase Postgres + Storage, Gemini 2.0 Flash (vision), Groq llama3-8b (item matching), Tesseract.js (browser fallback), Zod (validation).

---

## File Structure

### New files to create

| File | Responsibility |
|------|---------------|
| `lib/utils/unitAliases.ts` | `UNIT_ALIASES` map + `normaliseUnit()` |
| `lib/ocr/preprocessImage.ts` | Client-only canvas resize + greyscale + base64 |
| `lib/ocr/tesseractClient.ts` | Browser Tesseract.js wrapper with progress callback |
| `lib/ocr/normaliseItems.ts` | Server-only: clean names, normalise units, LLM match |
| `app/api/ocr/extract/route.ts` | POST: Gemini vision → parse → normalise → return table rows |
| `app/api/ocr/confirm/route.ts` | POST: upload image, call RPC, return bill_id |
| `supabase/migrations/005_bill_confirm_rpc.sql` | RPC + storage bucket + storage RLS |
| `app/(app)/scanner/UploadZone.tsx` | Drag/drop upload UI + manual text textarea |
| `app/(app)/scanner/ConfirmTable.tsx` | Editable item table + bill meta inputs + bottom bar |
| `app/(app)/scanner/page.tsx` | State machine (idle → processing → confirming → success) |
| `app/(app)/scanner/loading.tsx` | Loading skeleton for initial page load |
| `app/(app)/scanner/error.tsx` | Error boundary for scanner route |

### Files to modify

| File | Change |
|------|--------|
| `lib/llm/prompts/billParse.ts` | Add `billVisionPrompt()` — static prompt for Gemini vision (no args) |

### Key type contract (used across tasks)

```typescript
// Produced by normaliseItems.ts, consumed by ConfirmTable + confirm route
type NormalisedItem = {
  raw_name: string
  clean_name: string
  quantity: number | null
  unit: string
  price_per_unit: number | null
  total_price: number | null
  matched_item_id: string | null
  matched_item_name: string | null
  confidence_score: number   // 0–1
  is_new_item: boolean
}

// Sent by ConfirmTable → page → confirm route
type ConfirmedItem = {
  item_id: string | null   // null = new item
  name: string
  quantity: number
  unit: string
  price_per_unit: number | null
  is_new_item: boolean
}

type BillMeta = {
  supplier_name: string
  bill_date: string          // YYYY-MM-DD
  bill_number: string
}
```

---

## Task 1: Unit aliases utility

**Files:**
- Create: `lib/utils/unitAliases.ts`

- [ ] **Step 1: Create the file**

```typescript
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
```

- [ ] **Step 2: Verify the file compiles**

```bash
npx tsc --noEmit
```

Expected: no errors related to `unitAliases.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/utils/unitAliases.ts
git commit -m "feat: add unit aliases utility for OCR normalisation"
```

---

## Task 2: Add billVisionPrompt to existing billParse.ts

**Files:**
- Modify: `lib/llm/prompts/billParse.ts`

The existing `billParsePrompt(rawText)` handles text-only Groq parsing. We need a separate vision prompt for Gemini (no raw text — the image is passed as inlineData).

- [ ] **Step 1: Add billVisionPrompt to the file**

Open `lib/llm/prompts/billParse.ts` and append after the existing `billParsePrompt` export:

```typescript
export function billVisionPrompt(): string {
  return `You are reading a purchase bill or invoice image.

Extract ALL line items you can see.
Return ONLY a valid JSON array. No explanation, no markdown, no preamble.

Each item must have exactly these fields:
{
  "name": "item name as written on bill",
  "quantity": numeric value only or null if not visible,
  "unit": "unit as written (kg, g, pcs, etc) or null if not visible",
  "price_per_unit": numeric or null if not visible,
  "total_price": numeric or null if not visible
}

Rules:
- Use null for any value you cannot read clearly.
- Never guess or invent values. If unsure, use null.
- Strip currency symbols from price values — return numbers only.
- If the image is not a bill or is completely unreadable, return [].`
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/llm/prompts/billParse.ts
git commit -m "feat: add billVisionPrompt for Gemini vision OCR"
```

---

## Task 3: Client-side image preprocessing

**Files:**
- Create: `lib/ocr/preprocessImage.ts`

This runs in the browser only. It validates, resizes, greyscales, and returns base64.

- [ ] **Step 1: Create the file**

```typescript
// lib/ocr/preprocessImage.ts
'use client'
// Client component: browser Canvas API — never import in server code

import { OCR_MAX_FILE_SIZE_MB } from '@/lib/constants'

const ACCEPTED_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
const MAX_WIDTH = 1600
const JPEG_QUALITY = 0.85

export type PreprocessResult = {
  base64: string
  mimeType: 'image/jpeg' | 'image/png'
  originalSize: number
  processedSize: number
}

export async function preprocessImage(file: File): Promise<PreprocessResult> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error('Please upload a JPG, PNG, PDF, or WebP file.')
  }

  const maxBytes = OCR_MAX_FILE_SIZE_MB * 1024 * 1024
  if (file.size > maxBytes) {
    throw new Error(`Please use an image under ${OCR_MAX_FILE_SIZE_MB}MB.`)
  }

  // PDFs: skip canvas processing, return as-is in base64
  if (file.type === 'application/pdf') {
    const arrayBuffer = await file.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.byteLength; i++) {
      binary += String.fromCharCode(bytes[i] ?? 0)
    }
    const base64 = btoa(binary)
    return {
      base64,
      mimeType: 'image/jpeg', // placeholder — caller uses 'application/pdf' for PDFs
      originalSize: file.size,
      processedSize: file.size,
    }
  }

  const imageBitmap = await createImageBitmap(file)

  const scale = imageBitmap.width > MAX_WIDTH ? MAX_WIDTH / imageBitmap.width : 1
  const width = Math.round(imageBitmap.width * scale)
  const height = Math.round(imageBitmap.height * scale)

  const canvas = document.createElement('canvas')
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('Canvas context unavailable.')

  ctx.drawImage(imageBitmap, 0, 0, width, height)

  // Greyscale: ITU-R BT.601 luma coefficients
  const imageData = ctx.getImageData(0, 0, width, height)
  const data = imageData.data
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i] ?? 0
    const g = data[i + 1] ?? 0
    const b = data[i + 2] ?? 0
    const grey = Math.round(0.299 * r + 0.587 * g + 0.114 * b)
    data[i] = grey
    data[i + 1] = grey
    data[i + 2] = grey
    // alpha (data[i + 3]) unchanged
  }
  ctx.putImageData(imageData, 0, 0)

  const dataUrl = canvas.toDataURL('image/jpeg', JPEG_QUALITY)
  // dataUrl format: "data:image/jpeg;base64,<base64>"
  const base64 = dataUrl.split(',')[1] ?? ''

  // Approximate processed size in bytes
  const processedSize = Math.round((base64.length * 3) / 4)

  return {
    base64,
    mimeType: 'image/jpeg',
    originalSize: file.size,
    processedSize,
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ocr/preprocessImage.ts
git commit -m "feat: add client-side image preprocessing for bill OCR"
```

---

## Task 4: Client-side Tesseract wrapper

**Files:**
- Create: `lib/ocr/tesseractClient.ts`

Browser-only. Wraps Tesseract.js to extract text with a progress callback. Used as preliminary pass and as fallback if Gemini fails.

- [ ] **Step 1: Create the file**

```typescript
// lib/ocr/tesseractClient.ts
'use client'
// Client component: Tesseract.js runs in the browser only

import Tesseract from 'tesseract.js'

/**
 * Runs Tesseract OCR on a base64-encoded image.
 * Calls onProgress with values 0–100 as recognition progresses.
 * Returns raw OCR text. Returns empty string on any failure —
 * this is a helper/fallback, not the primary path.
 */
export async function extractTextClient(
  imageBase64: string,
  onProgress: (pct: number) => void
): Promise<string> {
  try {
    const dataUrl = `data:image/jpeg;base64,${imageBase64}`

    const worker = await Tesseract.createWorker('eng', 1, {
      logger: (m: { status: string; progress: number }) => {
        if (m.status === 'recognizing text') {
          onProgress(Math.round(m.progress * 100))
        }
      },
    })

    const result = await worker.recognize(dataUrl)
    await worker.terminate()

    onProgress(100)
    return result.data.text
  } catch {
    // Never crash — Tesseract is a fallback helper
    onProgress(100)
    return ''
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ocr/tesseractClient.ts
git commit -m "feat: add browser Tesseract.js wrapper for bill OCR fallback"
```

---

## Task 5: Server-side item normalisation

**Files:**
- Create: `lib/ocr/normaliseItems.ts`

Server-only. Cleans names, normalises units, exact-matches against DB, calls Groq for fuzzy matching, falls back to Levenshtein.

- [ ] **Step 1: Create the file**

```typescript
// lib/ocr/normaliseItems.ts
import 'server-only'

import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { routeLLMTask } from '@/lib/llm/router'
import { findBestMatch } from '@/lib/utils/fuzzyMatch'
import { normaliseUnit } from '@/lib/utils/unitAliases'
import { OCR_CONFIDENCE_THRESHOLD } from '@/lib/constants'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RawExtractedItem = {
  name: string
  quantity: number | null
  unit: string | null
  price_per_unit: number | null
  total_price: number | null
}

export type NormalisedItem = {
  raw_name: string
  clean_name: string
  quantity: number | null
  unit: string
  price_per_unit: number | null
  total_price: number | null
  matched_item_id: string | null
  matched_item_name: string | null
  confidence_score: number
  is_new_item: boolean
}

// ─── Zod schema for LLM response ──────────────────────────────────────────────

const llmMatchSchema = z.array(
  z.object({
    extracted_name: z.string(),
    matched_id: z.string().nullable(),
    matched_name: z.string().nullable(),
    confidence: z.number(),
  })
)

// ─── Name cleaning ─────────────────────────────────────────────────────────────

function cleanName(raw: string): string {
  return raw
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
}

// ─── Main export ───────────────────────────────────────────────────────────────

export async function normaliseExtractedItems(
  items: RawExtractedItem[],
  org_id: string,
  user_id: string
): Promise<NormalisedItem[]> {
  if (items.length === 0) return []

  // 1. Clean names and normalise units
  const cleaned = items.map((item) => ({
    ...item,
    clean_name: cleanName(item.name),
    unit: normaliseUnit(item.unit ?? 'pcs'),
  }))

  // 2. Fetch existing items for this org
  const supabase = await createServerClient()
  const { data: existingItems } = await supabase
    .from('items')
    .select('id, name, name_normalised')
    .eq('org_id', org_id)
    .eq('is_archived', false)

  const inventory = existingItems ?? []

  // 3. Exact match first — confidence 1.0
  const exactMatched = new Map<string, { matched_item_id: string; matched_item_name: string }>()
  for (const cleaned_item of cleaned) {
    const exact = inventory.find((inv) => inv.name_normalised === cleaned_item.clean_name)
    if (exact) {
      exactMatched.set(cleaned_item.clean_name, {
        matched_item_id: exact.id,
        matched_item_name: exact.name,
      })
    }
  }

  // 4. Items without exact match → batch to LLM
  const needsFuzzy = cleaned.filter((c) => !exactMatched.has(c.clean_name))

  const llmMatches = new Map<
    string,
    { matched_id: string | null; matched_name: string | null; confidence: number }
  >()

  if (needsFuzzy.length > 0) {
    const extractedNames = needsFuzzy.map((c) => c.clean_name)
    const existingForLLM = inventory.map((inv) => ({ id: inv.id, name: inv.name }))

    try {
      const llmResult = await routeLLMTask({
        task: 'item_normalise',
        payload: {
          extracted_names: extractedNames,
          existing_items: existingForLLM,
        },
        org_id,
        user_id,
      })

      const parsed = llmMatchSchema.parse(JSON.parse(llmResult.result))
      for (const match of parsed) {
        llmMatches.set(match.extracted_name, {
          matched_id: match.matched_id,
          matched_name: match.matched_name,
          confidence: match.confidence,
        })
      }
    } catch {
      // LLM failed or parse failed — fall back to Levenshtein for each item
      for (const item of needsFuzzy) {
        const candidateNames = inventory.map((inv) => inv.name)
        const best = findBestMatch(item.clean_name, candidateNames)
        if (best && best.score >= OCR_CONFIDENCE_THRESHOLD) {
          const matched = inventory.find((inv) => inv.name === best.match)
          llmMatches.set(item.clean_name, {
            matched_id: matched?.id ?? null,
            matched_name: matched?.name ?? null,
            confidence: best.score,
          })
        } else {
          llmMatches.set(item.clean_name, {
            matched_id: null,
            matched_name: null,
            confidence: best?.score ?? 0,
          })
        }
      }
    }
  }

  // 5. Build final NormalisedItem array
  return cleaned.map((item) => {
    const exact = exactMatched.get(item.clean_name)
    if (exact) {
      return {
        raw_name: item.name,
        clean_name: item.clean_name,
        quantity: item.quantity,
        unit: item.unit,
        price_per_unit: item.price_per_unit,
        total_price: item.total_price,
        matched_item_id: exact.matched_item_id,
        matched_item_name: exact.matched_item_name,
        confidence_score: 1.0,
        is_new_item: false,
      }
    }

    const fuzzy = llmMatches.get(item.clean_name)
    const confidence = fuzzy?.confidence ?? 0
    const is_new_item = !fuzzy?.matched_id || confidence < OCR_CONFIDENCE_THRESHOLD

    return {
      raw_name: item.name,
      clean_name: item.clean_name,
      quantity: item.quantity,
      unit: item.unit,
      price_per_unit: item.price_per_unit,
      total_price: item.total_price,
      matched_item_id: is_new_item ? null : (fuzzy?.matched_id ?? null),
      matched_item_name: is_new_item ? null : (fuzzy?.matched_name ?? null),
      confidence_score: confidence,
      is_new_item,
    }
  })
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add lib/ocr/normaliseItems.ts
git commit -m "feat: add server-side item normalisation for OCR pipeline"
```

---

## Task 6: Migration 005 — bill confirm RPC + storage bucket

**Files:**
- Create: `supabase/migrations/005_bill_confirm_rpc.sql`

This is the atomic Postgres function that the confirm route calls. It also creates the `bill-images` storage bucket and RLS policies.

- [ ] **Step 1: Create the migration file**

```sql
-- supabase/migrations/005_bill_confirm_rpc.sql

-- ─── Atomic bill confirmation function ───────────────────────────────────────
-- Called from /api/ocr/confirm after user approves the scanned bill.
-- Creates the bill row, inserts new items if needed, and inserts transactions.
-- The existing trigger on transactions updates items.current_stock atomically.

create or replace function confirm_bill_and_update_stock(
  p_org_id        uuid,
  p_user_id       uuid,
  p_supplier_name text,
  p_bill_date     date,
  p_bill_number   text,
  p_image_url     text,
  p_items         jsonb
  -- jsonb array of:
  -- { item_id: uuid | null, name: text, quantity: numeric,
  --   unit: text, unit_multiplier: numeric,
  --   price_per_unit: numeric | null, is_new_item: boolean }
)
returns uuid   -- returns the new bill_id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_bill_id       uuid;
  v_item          record;
  v_new_item_id   uuid;
  v_final_item_id uuid;
begin
  -- 1. Insert the bill row
  insert into bills (
    org_id, supplier_name, bill_date,
    bill_number, image_url, status, created_by
  ) values (
    p_org_id, p_supplier_name, p_bill_date,
    p_bill_number, p_image_url, 'confirmed', p_user_id
  )
  returning id into v_bill_id;

  -- 2. Loop through each item in the payload
  for v_item in
    select *
    from jsonb_to_recordset(p_items) as x(
      item_id        uuid,
      name           text,
      quantity       numeric,
      unit           text,
      unit_multiplier numeric,
      price_per_unit numeric,
      is_new_item    boolean
    )
  loop
    -- Create a new item in the catalogue if needed
    if v_item.is_new_item or v_item.item_id is null then
      insert into items (
        org_id, name, unit, current_stock
      ) values (
        p_org_id, v_item.name, v_item.unit, 0
      )
      returning id into v_new_item_id;
      v_final_item_id := v_new_item_id;
    else
      v_final_item_id := v_item.item_id;
    end if;

    -- Update cost_per_unit on the item with the latest bill price
    if v_item.price_per_unit is not null then
      update items
      set cost_per_unit = v_item.price_per_unit,
          updated_at    = now()
      where id = v_final_item_id;
    end if;

    -- Insert transaction — trigger will update items.current_stock
    insert into transactions (
      org_id, item_id, type, quantity,
      unit, unit_multiplier, cost_per_unit,
      bill_id, performed_by
    ) values (
      p_org_id, v_final_item_id, 'bill_addition',
      v_item.quantity, v_item.unit,
      coalesce(v_item.unit_multiplier, 1),
      v_item.price_per_unit,
      v_bill_id, p_user_id
    );
  end loop;

  return v_bill_id;
end;
$$;

-- ─── Storage bucket for bill images ──────────────────────────────────────────

insert into storage.buckets (id, name, public)
values ('bill-images', 'bill-images', false)
on conflict (id) do nothing;

-- RLS: authenticated users can upload bill images
create policy "Users can upload bill images"
on storage.objects for insert
with check (
  bucket_id = 'bill-images'
  and auth.uid() is not null
);

-- RLS: authenticated users can read bill images
create policy "Users can read bill images"
on storage.objects for select
using (
  bucket_id = 'bill-images'
  and auth.uid() is not null
);
```

- [ ] **Step 2: Run the migration in Supabase**

Option A (Supabase CLI):
```bash
npx supabase db push
```

Option B (Supabase dashboard): Open the SQL Editor, paste the full contents of `005_bill_confirm_rpc.sql`, and run.

Expected output: function created, bucket created.

- [ ] **Step 3: Verify the RPC exists in Supabase**

In the Supabase dashboard → Database → Functions, confirm `confirm_bill_and_update_stock` appears.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/005_bill_confirm_rpc.sql
git commit -m "feat: add confirm_bill_and_update_stock RPC and bill-images storage bucket"
```

---

## Task 7: OCR extract API route

**Files:**
- Create: `app/api/ocr/extract/route.ts`

Receives base64 image + Tesseract text from client. Calls Gemini vision via the LLM router. Parses response. Normalises items. Returns `NormalisedItem[]`.

- [ ] **Step 1: Create the file**

```typescript
// app/api/ocr/extract/route.ts
import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { routeLLMTask } from '@/lib/llm/router'
import { billVisionPrompt } from '@/lib/llm/prompts/billParse'
import { billParseFallback } from '@/lib/llm/fallbacks'
import { normaliseExtractedItems, type RawExtractedItem } from '@/lib/ocr/normaliseItems'

// ─── Input schema ─────────────────────────────────────────────────────────────

const extractSchema = z.object({
  imageBase64: z.string().min(1),
  mimeType: z.string(),
  tesseractText: z.string(),
  // org_id and user_id are ignored — always derived from session (rule S2)
})

// ─── Zod schema for parsed bill items ─────────────────────────────────────────

const rawItemSchema = z.array(
  z.object({
    name: z.string(),
    quantity: z.number().nullable(),
    unit: z.string().nullable(),
    price_per_unit: z.number().nullable(),
    total_price: z.number().nullable(),
  })
)

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Authenticate — org_id and user_id always from session
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) {
    return NextResponse.json({ error: 'Organisation not found' }, { status: 401 })
  }

  const org_id = profile.org_id
  const user_id = user.id

  // 2. Validate input
  const body: unknown = await request.json()
  const parsed = extractSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json({ error: 'Missing image data.' }, { status: 400 })
  }

  const { imageBase64, mimeType, tesseractText } = parsed.data

  // 3. Call Gemini vision via LLM router
  // Always returns 200 — fallback to Tesseract if Gemini is unavailable
  const visionResult = await routeLLMTask({
    task: 'bill_vision',
    payload: {
      image_base64: imageBase64,
      mime_type: mimeType as 'image/jpeg' | 'image/png' | 'application/pdf',
      prompt: billVisionPrompt(),
      tesseract_text: tesseractText,
    },
    org_id,
    user_id,
  })

  // 4. Parse the vision result as JSON array of items
  let rawItems: RawExtractedItem[]
  let fallback_used = visionResult.fallback_used

  const jsonParseResult = rawItemSchema.safeParse(
    (() => {
      try {
        // Strip markdown code fences if Gemini wrapped the JSON
        const cleaned = visionResult.result
          .replace(/^```(?:json)?\s*/i, '')
          .replace(/\s*```$/, '')
          .trim()
        return JSON.parse(cleaned)
      } catch {
        return null
      }
    })()
  )

  if (jsonParseResult.success) {
    rawItems = jsonParseResult.data
  } else {
    // JSON parse failed — Gemini returned text, or we got Tesseract text
    // Use the text-based bill parse fallback
    rawItems = billParseFallback(visionResult.result || tesseractText)
    fallback_used = true
  }

  if (rawItems.length === 0 && tesseractText.length > 10) {
    rawItems = billParseFallback(tesseractText)
    fallback_used = true
  }

  // 5. Normalise + match items to existing inventory
  const normalisedItems = await normaliseExtractedItems(rawItems, org_id, user_id)

  // 6. Respond — always 200 (OCR never returns 500)
  return NextResponse.json({
    items: normalisedItems,
    fallback_used,
  })
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/ocr/extract/route.ts
git commit -m "feat: add OCR extract API route (Gemini vision + item normalisation)"
```

---

## Task 8: OCR confirm API route

**Files:**
- Create: `app/api/ocr/confirm/route.ts`

Receives confirmed items + bill metadata. Optionally uploads image to Supabase Storage. Calls the atomic RPC. Returns `{ success, bill_id, items_added }`.

- [ ] **Step 1: Create the file**

```typescript
// app/api/ocr/confirm/route.ts
import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { v4 as uuidv4 } from 'uuid'
import { createServerClient } from '@/lib/supabase/server'
import { BILL_IMAGES_BUCKET } from '@/lib/constants'

// ─── Input schema ─────────────────────────────────────────────────────────────

const confirmedItemSchema = z.object({
  item_id: z.string().uuid().nullable(),
  name: z.string().min(1),
  quantity: z.number().positive(),
  unit: z.string().min(1),
  price_per_unit: z.number().nullable(),
  is_new_item: z.boolean(),
})

const confirmSchema = z.object({
  items: z.array(confirmedItemSchema).min(1),
  supplier_name: z.string(),
  bill_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  bill_number: z.string(),
  image_base64: z.string().nullable(),
  image_mime_type: z.string().nullable(),
})

// ─── POST handler ─────────────────────────────────────────────────────────────

export async function POST(request: NextRequest): Promise<NextResponse> {
  // 1. Authenticate
  const supabase = await createServerClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await supabase
    .from('user_profiles')
    .select('org_id')
    .eq('id', user.id)
    .single()

  if (!profile?.org_id) {
    return NextResponse.json({ error: 'Organisation not found' }, { status: 401 })
  }

  const org_id = profile.org_id
  const user_id = user.id

  // 2. Validate input
  const body: unknown = await request.json()
  const parsed = confirmSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: 'Invalid request. Check all items have a name and quantity > 0.' },
      { status: 400 }
    )
  }

  const { items, supplier_name, bill_date, bill_number, image_base64, image_mime_type } =
    parsed.data

  // 3. Upload image to storage if provided
  let image_url: string | null = null

  if (image_base64 && image_mime_type) {
    try {
      const billImageId = uuidv4()
      const now = new Date(bill_date)
      const year = now.getFullYear()
      const month = String(now.getMonth() + 1).padStart(2, '0')
      const extension = image_mime_type.includes('png') ? 'png' : 'jpg'
      const storagePath = `${org_id}/${year}/${month}/${billImageId}.${extension}`

      const binaryStr = atob(image_base64)
      const bytes = new Uint8Array(binaryStr.length)
      for (let i = 0; i < binaryStr.length; i++) {
        bytes[i] = binaryStr.charCodeAt(i)
      }

      const { error: uploadError } = await supabase.storage
        .from(BILL_IMAGES_BUCKET)
        .upload(storagePath, bytes, {
          contentType: image_mime_type,
          upsert: false,
        })

      if (!uploadError) {
        const { data: urlData } = supabase.storage
          .from(BILL_IMAGES_BUCKET)
          .getPublicUrl(storagePath)
        image_url = urlData.publicUrl
      }
      // If upload fails, continue without image — not a blocking error
    } catch {
      // Image upload failure is non-fatal — bill can still be confirmed
    }
  }

  // 4. Build items payload for the RPC
  const rpcItems = items.map((item) => ({
    item_id: item.item_id,
    name: item.name,
    quantity: item.quantity,
    unit: item.unit,
    unit_multiplier: 1, // Phase 1: always 1, unit conversion in Phase 2
    price_per_unit: item.price_per_unit,
    is_new_item: item.is_new_item,
  }))

  // 5. Call atomic RPC — creates bill + items + transactions in one transaction
  const { data: bill_id, error: rpcError } = await supabase.rpc(
    'confirm_bill_and_update_stock',
    {
      p_org_id: org_id,
      p_user_id: user_id,
      p_supplier_name: supplier_name || null,
      p_bill_date: bill_date,
      p_bill_number: bill_number || null,
      p_image_url: image_url,
      p_items: rpcItems,
    }
  )

  if (rpcError) {
    return NextResponse.json(
      { error: 'Failed to save bill. Please try again.' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    success: true,
    bill_id,
    items_added: items.length,
  })
}
```

**Note:** `uuid` is not installed. Replace `uuidv4()` with a crypto-based alternative:

In the file above, replace the `import { v4 as uuidv4 } from 'uuid'` line and `uuidv4()` call:

```typescript
// Remove the uuid import. Use crypto.randomUUID() instead:
const billImageId = crypto.randomUUID()
```

- [ ] **Step 2: Apply the uuid fix**

In `app/api/ocr/confirm/route.ts`, ensure:
- No `import { v4 as uuidv4 } from 'uuid'` line exists
- `uuidv4()` is replaced with `crypto.randomUUID()`

Final top of file:
```typescript
// app/api/ocr/confirm/route.ts
import 'server-only'

import { NextRequest, NextResponse } from 'next/server'
import { z } from 'zod'
import { createServerClient } from '@/lib/supabase/server'
import { BILL_IMAGES_BUCKET } from '@/lib/constants'
```

And inside the storage upload block:
```typescript
const billImageId = crypto.randomUUID()
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/api/ocr/confirm/route.ts
git commit -m "feat: add OCR confirm API route with atomic RPC + storage upload"
```

---

## Task 9: UploadZone component

**Files:**
- Create: `app/(app)/scanner/UploadZone.tsx`

Client component. Handles drag-and-drop and file input. Shows the manual text textarea. Calls `onFileSelect` or `onTextSubmit`.

- [ ] **Step 1: Create the file**

```typescript
// app/(app)/scanner/UploadZone.tsx
'use client'
// Client component: needs drag/drop events + file input state

import { useRef, useState } from 'react'

type UploadZoneProps = {
  onFileSelect: (file: File) => void
  onTextSubmit: (text: string) => void
  disabled: boolean
}

export default function UploadZone({ onFileSelect, onTextSubmit, disabled }: UploadZoneProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [manualText, setManualText] = useState('')

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave() {
    setIsDragging(false)
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault()
    setIsDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) onFileSelect(file)
  }

  function handleFileInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) onFileSelect(file)
  }

  return (
    <section className="flex-1 space-y-6">
      {/* Drop zone */}
      <div
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        className={[
          'bg-surface-container-low p-8 rounded-xl flex flex-col items-center justify-center min-h-[360px] transition-all',
          isDragging
            ? 'border-2 border-dashed border-primary-container/60'
            : 'border-2 border-dashed border-primary-container/0 hover:border-primary-container/30',
        ].join(' ')}
      >
        <div className="w-16 h-16 bg-primary-fixed rounded-2xl flex items-center justify-center text-primary mb-6">
          <span
            className="material-symbols-outlined text-[40px]"
            style={{ fontVariationSettings: "'FILL' 0" }}
          >
            photo_camera
          </span>
        </div>

        <p className="text-lg font-medium text-on-surface mb-2 text-center">
          Drop a bill photo here
        </p>
        <p className="text-sm text-on-surface/60 mb-8 text-center max-w-xs">
          Supports JPG, PNG, PDF · Max 10MB · Gemini Vision reads the details automatically
        </p>

        <button
          type="button"
          disabled={disabled}
          onClick={() => fileInputRef.current?.click()}
          className="px-6 py-3 bg-surface-container-lowest text-on-surface font-semibold rounded-lg border border-outline-variant/15 hover:shadow-md transition-all active:scale-95 disabled:opacity-50"
        >
          Choose file
        </button>

        <input
          ref={fileInputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp,application/pdf"
          className="hidden"
          onChange={handleFileInputChange}
        />
      </div>

      {/* Manual text paste */}
      <div className="space-y-3">
        <label className="text-[10px] uppercase tracking-wider font-semibold text-on-surface/50 px-1">
          Or paste bill text manually
        </label>
        <textarea
          value={manualText}
          onChange={(e) => setManualText(e.target.value)}
          placeholder="Paste OCR text or raw data here..."
          disabled={disabled}
          className="w-full h-32 bg-surface-container-lowest rounded-xl p-4 text-sm focus:ring-2 focus:ring-primary-fixed placeholder:text-on-surface/30 resize-none border-none outline-none disabled:opacity-50"
        />
        {manualText.trim().length > 5 && (
          <button
            type="button"
            onClick={() => onTextSubmit(manualText)}
            disabled={disabled}
            className="px-6 py-2.5 bg-gradient-to-r from-primary to-primary-container text-on-primary text-sm font-semibold rounded-lg hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-50"
          >
            Parse text
          </button>
        )}
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/scanner/UploadZone.tsx
git commit -m "feat: add UploadZone component for bill scanner"
```

---

## Task 10: ConfirmTable component

**Files:**
- Create: `app/(app)/scanner/ConfirmTable.tsx`

Client component. Renders editable rows for each detected item. Shows confidence indicators. Manages bill metadata inputs (supplier, date, bill number). Emits confirmed data when user clicks Confirm.

- [ ] **Step 1: Create the file**

```typescript
// app/(app)/scanner/ConfirmTable.tsx
'use client'
// Client component: manages editable table state for bill confirmation

import { useState } from 'react'
import type { NormalisedItem } from '@/lib/ocr/normaliseItems'

export type ConfirmedItem = {
  item_id: string | null
  name: string
  quantity: number
  unit: string
  price_per_unit: number | null
  is_new_item: boolean
}

export type BillMeta = {
  supplier_name: string
  bill_date: string
  bill_number: string
}

type EditableRow = {
  id: string              // local key for React
  item_id: string | null
  name: string
  quantity: string        // string so empty is valid during editing
  unit: string
  price: string           // string so empty is valid during editing
  is_new_item: boolean
  confidence_score: number
}

const COMMON_UNITS = ['kg', 'g', 'l', 'ml', 'pcs', 'tabs', 'strips', 'pkt', 'box', 'dozen']

function today(): string {
  return new Date().toISOString().split('T')[0] ?? ''
}

type Props = {
  items: NormalisedItem[]
  fallbackUsed: boolean
  onConfirm: (items: ConfirmedItem[], meta: BillMeta) => void
  onDiscard: () => void
  isSubmitting: boolean
}

export default function ConfirmTable({
  items,
  fallbackUsed,
  onConfirm,
  onDiscard,
  isSubmitting,
}: Props) {
  const [rows, setRows] = useState<EditableRow[]>(() =>
    items.map((item, idx) => ({
      id: `row-${idx}`,
      item_id: item.matched_item_id,
      name: item.clean_name,
      quantity: item.quantity != null ? String(item.quantity) : '',
      unit: item.unit,
      price: item.price_per_unit != null ? String(item.price_per_unit) : '',
      is_new_item: item.is_new_item,
      confidence_score: item.confidence_score,
    }))
  )

  const [meta, setMeta] = useState<BillMeta>({
    supplier_name: '',
    bill_date: today(),
    bill_number: '',
  })

  function updateRow(id: string, patch: Partial<EditableRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)))
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id))
  }

  function addEmptyRow() {
    setRows((prev) => [
      ...prev,
      {
        id: `row-${Date.now()}`,
        item_id: null,
        name: '',
        quantity: '',
        unit: 'pcs',
        price: '',
        is_new_item: true,
        confidence_score: 0,
      },
    ])
  }

  const hasInvalidRows = rows.some((r) => !r.name.trim() || !r.quantity || parseFloat(r.quantity) <= 0)
  const canConfirm = rows.length > 0 && !hasInvalidRows && !isSubmitting

  // Summary stats
  const totalAmount = rows.reduce((sum, r) => {
    const qty = parseFloat(r.quantity) || 0
    const price = parseFloat(r.price) || 0
    return sum + qty * price
  }, 0)

  function handleConfirm() {
    const confirmedItems: ConfirmedItem[] = rows.map((r) => ({
      item_id: r.is_new_item ? null : r.item_id,
      name: r.name.trim(),
      quantity: parseFloat(r.quantity),
      unit: r.unit,
      price_per_unit: r.price ? parseFloat(r.price) : null,
      is_new_item: r.is_new_item,
    }))
    onConfirm(confirmedItems, meta)
  }

  return (
    <section className="flex-[1.5] space-y-6 pb-32">
      {/* Fallback warning */}
      {fallbackUsed && (
        <div className="flex items-start gap-3 bg-tertiary-fixed/30 border border-tertiary-fixed px-4 py-3 rounded-xl">
          <span
            className="material-symbols-outlined text-tertiary mt-0.5"
            style={{ fontVariationSettings: "'FILL' 1" }}
          >
            warning
          </span>
          <p className="text-sm text-on-surface/80">
            AI reading unavailable — showing basic scan instead. Please verify all items carefully.
          </p>
        </div>
      )}

      {/* Confirmation table card */}
      <div
        className="bg-surface-container-lowest rounded-xl overflow-hidden"
        style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
      >
        {/* Card header */}
        <div className="px-6 py-4 bg-surface-container-low/50 flex justify-between items-center">
          <div>
            <h3 className="text-sm font-bold uppercase tracking-widest text-on-surface/70">
              What we found
            </h3>
            <p className="text-xs text-on-surface/40 mt-0.5">Edit anything before confirming</p>
          </div>
          <div className="flex gap-6">
            <div className="flex flex-col">
              <label className="text-[10px] text-on-surface/40 uppercase font-bold mb-0.5">
                Supplier
              </label>
              <input
                type="text"
                value={meta.supplier_name}
                onChange={(e) => setMeta((m) => ({ ...m, supplier_name: e.target.value }))}
                placeholder="Supplier name"
                className="bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 text-primary placeholder:text-on-surface/30 outline-none"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-on-surface/40 uppercase font-bold mb-0.5">
                Date
              </label>
              <input
                type="date"
                value={meta.bill_date}
                onChange={(e) => setMeta((m) => ({ ...m, bill_date: e.target.value }))}
                className="bg-transparent border-none p-0 text-sm font-semibold focus:ring-0 outline-none"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[10px] text-on-surface/40 uppercase font-bold mb-0.5">
                Bill #
              </label>
              <input
                type="text"
                value={meta.bill_number}
                onChange={(e) => setMeta((m) => ({ ...m, bill_number: e.target.value }))}
                placeholder="Optional"
                className="bg-transparent border-none p-0 text-sm focus:ring-0 text-on-surface/60 placeholder:text-on-surface/30 outline-none"
              />
            </div>
          </div>
        </div>

        {/* Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-surface-container-low/30">
                <th className="px-6 py-3 text-[10px] uppercase tracking-wider font-bold text-on-surface/50">
                  Item Name
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-on-surface/50 text-center">
                  Qty
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-on-surface/50 text-center">
                  Unit
                </th>
                <th className="px-6 py-3 text-[10px] uppercase tracking-wider font-bold text-on-surface/50 text-right">
                  Price/unit
                </th>
                <th className="px-4 py-3 text-[10px] uppercase tracking-wider font-bold text-on-surface/50">
                  Match
                </th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => {
                const isLowConfidence = !row.is_new_item && row.confidence_score < 0.8 && row.confidence_score > 0
                const hasQtyError = row.quantity !== '' && parseFloat(row.quantity) <= 0
                const isMissingQty = row.quantity === ''

                const rowBg = row.is_new_item
                  ? 'bg-[#EEEEFD]'
                  : isLowConfidence
                  ? 'border-l-2 border-tertiary-fixed'
                  : ''

                return (
                  <tr
                    key={row.id}
                    className={`hover:bg-surface-container-low/20 transition-colors ${rowBg}`}
                  >
                    {/* Item name */}
                    <td className="px-6 py-3">
                      <input
                        type="text"
                        value={row.name}
                        onChange={(e) => updateRow(row.id, { name: e.target.value })}
                        className="w-full bg-transparent border-none p-0 text-sm font-medium focus:ring-0 outline-none"
                      />
                    </td>

                    {/* Quantity */}
                    <td className="px-4 py-3 text-center">
                      <input
                        type="number"
                        value={row.quantity}
                        min={0.001}
                        step="any"
                        onChange={(e) => updateRow(row.id, { quantity: e.target.value })}
                        className={[
                          'w-16 bg-transparent border-none p-0 text-sm font-mono text-center focus:ring-0 outline-none',
                          hasQtyError || isMissingQty ? 'ring-1 ring-error rounded' : '',
                        ].join(' ')}
                      />
                    </td>

                    {/* Unit */}
                    <td className="px-4 py-3 text-center">
                      <select
                        value={row.unit}
                        onChange={(e) => updateRow(row.id, { unit: e.target.value })}
                        className="bg-transparent border-none p-0 text-sm text-center focus:ring-0 outline-none opacity-60 cursor-pointer"
                      >
                        {COMMON_UNITS.map((u) => (
                          <option key={u} value={u}>
                            {u}
                          </option>
                        ))}
                        {!COMMON_UNITS.includes(row.unit) && (
                          <option value={row.unit}>{row.unit}</option>
                        )}
                      </select>
                    </td>

                    {/* Price */}
                    <td className="px-6 py-3 text-right">
                      <input
                        type="number"
                        value={row.price}
                        min={0}
                        step="any"
                        onChange={(e) => updateRow(row.id, { price: e.target.value })}
                        placeholder="—"
                        className="w-24 bg-transparent border-none p-0 text-sm font-mono font-bold text-right focus:ring-0 outline-none placeholder:text-on-surface/30"
                      />
                    </td>

                    {/* Match badge */}
                    <td className="px-4 py-3">
                      {row.is_new_item ? (
                        <span className="text-[10px] font-bold uppercase tracking-wider text-primary bg-primary-fixed px-2 py-0.5 rounded-full">
                          New item
                        </span>
                      ) : isLowConfidence ? (
                        <span
                          className="text-[10px] font-semibold text-tertiary flex items-center gap-1"
                          title="Low confidence — please verify"
                        >
                          <span
                            className="material-symbols-outlined text-sm"
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            warning
                          </span>
                          Verify
                        </span>
                      ) : (
                        <span className="text-[10px] text-on-surface/40">
                          {row.confidence_score === 1 ? '✓ Exact' : '✓ Matched'}
                        </span>
                      )}
                    </td>

                    {/* Remove */}
                    <td className="px-4 py-3 text-center">
                      <button
                        type="button"
                        onClick={() => removeRow(row.id)}
                        className="text-on-surface/30 hover:text-error transition-colors"
                      >
                        <span className="material-symbols-outlined text-sm">close</span>
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Add row */}
        <button
          type="button"
          onClick={addEmptyRow}
          className="w-full py-4 text-sm font-semibold text-primary-container hover:bg-surface-container transition-colors flex items-center justify-center gap-2"
        >
          <span className="material-symbols-outlined text-lg">add</span>
          Add item manually
        </button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-secondary-container/20 p-6 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-on-secondary-container/60 mb-1">
            Items Detected
          </p>
          <p className="text-2xl font-black text-on-secondary-container font-mono">
            {String(rows.length).padStart(2, '0')}
          </p>
        </div>
        <div className="bg-surface-container-low p-6 rounded-2xl">
          <p className="text-[10px] uppercase font-bold text-on-surface/40 mb-1">
            Total Amount
          </p>
          <p className="text-2xl font-black text-on-surface font-mono">
            {totalAmount > 0 ? `₹${totalAmount.toLocaleString('en-IN')}` : '—'}
          </p>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-0 left-[240px] right-0 bg-surface/90 backdrop-blur-xl border-t border-outline-variant/15 px-8 py-5 flex items-center justify-between z-50">
        <p className="text-xs text-on-surface/60 max-w-[260px]">
          Confirming will update stock levels for{' '}
          <strong>{rows.length} item{rows.length !== 1 ? 's' : ''}</strong>
          {meta.supplier_name ? ` from ${meta.supplier_name}` : ''}.
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={onDiscard}
            disabled={isSubmitting}
            className="px-8 py-3.5 text-on-surface/60 font-bold text-sm uppercase tracking-widest hover:text-on-surface transition-colors disabled:opacity-40"
          >
            Discard
          </button>
          <button
            type="button"
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="px-10 py-3.5 bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold text-sm rounded-lg hover:shadow-primary/20 hover:-translate-y-0.5 transition-all active:scale-95 disabled:opacity-40 flex items-center gap-3"
          >
            {isSubmitting ? 'Saving…' : 'Confirm & Add to Stock'}
            {!isSubmitting && (
              <span className="material-symbols-outlined text-lg">arrow_forward</span>
            )}
          </button>
        </div>
      </div>
    </section>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/scanner/ConfirmTable.tsx
git commit -m "feat: add editable ConfirmTable component for bill confirmation UI"
```

---

## Task 11: Scanner page (state machine)

**Files:**
- Create: `app/(app)/scanner/page.tsx`

Client component. Orchestrates the 4-state flow: idle → processing → confirming → success.

- [ ] **Step 1: Create the file**

```typescript
// app/(app)/scanner/page.tsx
'use client'
// Client component: state machine for upload → processing → confirm → success

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import UploadZone from './UploadZone'
import ConfirmTable, { type ConfirmedItem, type BillMeta } from './ConfirmTable'
import { preprocessImage } from '@/lib/ocr/preprocessImage'
import { extractTextClient } from '@/lib/ocr/tesseractClient'
import type { NormalisedItem } from '@/lib/ocr/normaliseItems'

// ─── Types ────────────────────────────────────────────────────────────────────

type ScanState = 'idle' | 'processing' | 'confirming' | 'success'

type ProcessingStep = {
  label: string
  done: boolean
}

type SuccessData = {
  billId: string
  itemsAdded: number
  items: { name: string; quantity: number; unit: string }[]
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ScannerPage() {
  const router = useRouter()

  const [state, setState] = useState<ScanState>('idle')
  const [error, setError] = useState<string | null>(null)

  // Processing state
  const [steps, setSteps] = useState<ProcessingStep[]>([
    { label: 'Reading image…', done: false },
    { label: 'AI extracting items…', done: false },
    { label: 'Matching to inventory…', done: false },
  ])
  const [tesseractProgress, setTesseractProgress] = useState(0)

  // Confirming state
  const [extractedItems, setExtractedItems] = useState<NormalisedItem[]>([])
  const [fallbackUsed, setFallbackUsed] = useState(false)
  const [capturedBase64, setCapturedBase64] = useState<string | null>(null)
  const [capturedMimeType, setCapturedMimeType] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Success state
  const [successData, setSuccessData] = useState<SuccessData | null>(null)

  function markStep(index: number) {
    setSteps((prev) => prev.map((s, i) => (i === index ? { ...s, done: true } : s)))
  }

  // ─── File select handler ────────────────────────────────────────────────────

  async function handleFileSelect(file: File) {
    setError(null)
    setState('processing')
    setSteps([
      { label: 'Reading image…', done: false },
      { label: 'AI extracting items…', done: false },
      { label: 'Matching to inventory…', done: false },
    ])
    setTesseractProgress(0)

    let base64 = ''
    let mimeType = 'image/jpeg'
    let tesseractText = ''

    try {
      // Stage 1a: preprocess image
      const preprocessed = await preprocessImage(file)
      base64 = preprocessed.base64
      mimeType = file.type === 'application/pdf' ? 'application/pdf' : preprocessed.mimeType
      setCapturedBase64(base64)
      setCapturedMimeType(mimeType)
      markStep(0)

      // Stage 1b: Tesseract in parallel (fire and don't await — we use it as fallback)
      extractTextClient(base64, (pct) => setTesseractProgress(pct))
        .then((text) => { tesseractText = text })
        .catch(() => { /* non-fatal */ })

      // Stage 2: Gemini vision extraction
      markStep(1)
      const extractRes = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: base64,
          mimeType,
          tesseractText,
        }),
      })

      if (!extractRes.ok) {
        const errBody = (await extractRes.json()) as { error?: string }
        throw new Error(errBody.error ?? 'Extraction failed.')
      }

      const extractData = (await extractRes.json()) as {
        items: NormalisedItem[]
        fallback_used: boolean
      }

      // Stage 3: normalisation complete (server handled it, just mark done)
      markStep(2)

      if (extractData.items.length === 0) {
        setError(
          "We couldn't read this bill clearly. Try a clearer photo or enter items manually."
        )
        setState('idle')
        return
      }

      setExtractedItems(extractData.items)
      setFallbackUsed(extractData.fallback_used)
      setState('confirming')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload failed. Please try again.'
      setError(message)
      setState('idle')
    }
  }

  // ─── Text submit handler (manual paste fallback) ────────────────────────────

  async function handleTextSubmit(text: string) {
    setError(null)
    setState('processing')
    setSteps([
      { label: 'Parsing text…', done: false },
      { label: 'AI extracting items…', done: false },
      { label: 'Matching to inventory…', done: false },
    ])

    try {
      markStep(0)
      const extractRes = await fetch('/api/ocr/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: '',
          mimeType: 'image/jpeg',
          tesseractText: text,
        }),
      })

      if (!extractRes.ok) {
        throw new Error('Extraction failed.')
      }

      const extractData = (await extractRes.json()) as {
        items: NormalisedItem[]
        fallback_used: boolean
      }

      markStep(1)
      markStep(2)

      setExtractedItems(extractData.items)
      setFallbackUsed(true) // text input always counts as fallback
      setCapturedBase64(null)
      setCapturedMimeType(null)
      setState('confirming')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Parsing failed. Please try again.'
      setError(message)
      setState('idle')
    }
  }

  // ─── Confirm handler ────────────────────────────────────────────────────────

  async function handleConfirm(items: ConfirmedItem[], meta: BillMeta) {
    setIsSubmitting(true)

    try {
      const res = await fetch('/api/ocr/confirm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items,
          supplier_name: meta.supplier_name,
          bill_date: meta.bill_date,
          bill_number: meta.bill_number,
          image_base64: capturedBase64,
          image_mime_type: capturedMimeType,
        }),
      })

      if (!res.ok) {
        const errBody = (await res.json()) as { error?: string }
        throw new Error(errBody.error ?? 'Failed to save bill.')
      }

      const data = (await res.json()) as { bill_id: string; items_added: number }

      setSuccessData({
        billId: data.bill_id,
        itemsAdded: data.items_added,
        items: items.map((item) => ({
          name: item.name,
          quantity: item.quantity,
          unit: item.unit,
        })),
      })
      setState('success')
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to save. Please try again.'
      setError(message)
    } finally {
      setIsSubmitting(false)
    }
  }

  function handleDiscard() {
    setState('idle')
    setExtractedItems([])
    setError(null)
    setCapturedBase64(null)
    setCapturedMimeType(null)
  }

  // ─── Render ─────────────────────────────────────────────────────────────────

  return (
    <>
      {/* Page header */}
      <div className="sticky top-0 z-30 bg-surface/80 backdrop-blur-md -mx-6 -mt-6 px-8 py-6 flex justify-between items-center mb-6">
        <h2 className="text-3xl font-bold tracking-tight text-on-surface">Scan a Bill</h2>
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-tertiary-fixed rounded-full">
            <span
              className="material-symbols-outlined text-on-tertiary-fixed text-sm"
              style={{ fontVariationSettings: "'FILL' 1" }}
            >
              auto_awesome
            </span>
            <span className="text-xs font-semibold text-on-tertiary-fixed uppercase tracking-wider">
              Gemini Vision Active
            </span>
          </div>
        </div>
      </div>

      {/* Error banner */}
      {error && (
        <div className="mb-6 flex items-start gap-3 bg-error-container px-4 py-3 rounded-xl">
          <span className="material-symbols-outlined text-error mt-0.5">error</span>
          <p className="text-sm text-on-error-container">{error}</p>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-auto text-on-error-container/60 hover:text-on-error-container"
          >
            <span className="material-symbols-outlined text-sm">close</span>
          </button>
        </div>
      )}

      {/* ── IDLE ─────────────────────────────────────────────────────────── */}
      {state === 'idle' && (
        <div className="flex flex-col lg:flex-row gap-8">
          <UploadZone
            onFileSelect={handleFileSelect}
            onTextSubmit={handleTextSubmit}
            disabled={false}
          />
          <div className="flex-[1.5] flex items-center justify-center min-h-[360px] bg-surface-container-low rounded-xl">
            <div className="text-center space-y-3 p-8">
              <span
                className="material-symbols-outlined text-[48px] text-on-surface/20"
                style={{ fontVariationSettings: "'FILL' 0" }}
              >
                receipt_long
              </span>
              <p className="text-sm text-on-surface/40">
                Your extracted items will appear here
              </p>
            </div>
          </div>
        </div>
      )}

      {/* ── PROCESSING ──────────────────────────────────────────────────── */}
      {state === 'processing' && (
        <div className="flex flex-col lg:flex-row gap-8">
          <UploadZone onFileSelect={handleFileSelect} onTextSubmit={handleTextSubmit} disabled />
          <div className="flex-[1.5] flex items-center justify-center min-h-[360px]">
            <div className="w-full max-w-sm space-y-8">
              {/* Progress bar */}
              <div className="space-y-2">
                <div className="h-2 bg-surface-container rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-primary to-primary-container rounded-full transition-all duration-500"
                    style={{
                      width: `${Math.max(
                        5,
                        (steps.filter((s) => s.done).length / steps.length) * 100
                      )}%`,
                    }}
                  />
                </div>
                <p className="text-xs text-on-surface/40 text-right font-mono">
                  Tesseract: {tesseractProgress}%
                </p>
              </div>

              {/* Step indicators */}
              <div className="space-y-4">
                {steps.map((step, idx) => (
                  <div key={idx} className="flex items-center gap-3">
                    <div
                      className={[
                        'w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 transition-colors',
                        step.done
                          ? 'bg-primary text-on-primary'
                          : idx === steps.findIndex((s) => !s.done)
                          ? 'bg-primary-fixed text-primary'
                          : 'bg-surface-container text-on-surface/30',
                      ].join(' ')}
                    >
                      {step.done ? (
                        <span className="material-symbols-outlined text-sm">check</span>
                      ) : idx === steps.findIndex((s) => !s.done) ? (
                        <span className="text-xs font-bold">{idx + 1}</span>
                      ) : (
                        <span className="text-xs font-bold">{idx + 1}</span>
                      )}
                    </div>
                    <span
                      className={[
                        'text-sm',
                        step.done ? 'text-on-surface font-medium' : 'text-on-surface/40',
                      ].join(' ')}
                    >
                      {step.label}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── CONFIRMING ──────────────────────────────────────────────────── */}
      {state === 'confirming' && (
        <div className="flex flex-col lg:flex-row gap-8">
          <UploadZone onFileSelect={handleFileSelect} onTextSubmit={handleTextSubmit} disabled />
          <ConfirmTable
            items={extractedItems}
            fallbackUsed={fallbackUsed}
            onConfirm={handleConfirm}
            onDiscard={handleDiscard}
            isSubmitting={isSubmitting}
          />
        </div>
      )}

      {/* ── SUCCESS ──────────────────────────────────────────────────────── */}
      {state === 'success' && successData && (
        <div className="flex items-center justify-center min-h-[60vh]">
          <div
            className="bg-surface-container-lowest rounded-2xl p-12 text-center max-w-md w-full"
            style={{ boxShadow: '0 12px 32px -4px rgba(27,28,22,0.06)' }}
          >
            <div className="w-16 h-16 bg-primary-fixed rounded-full flex items-center justify-center text-primary mx-auto mb-6">
              <span
                className="material-symbols-outlined text-[40px]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                check_circle
              </span>
            </div>
            <h3 className="text-2xl font-bold text-on-surface mb-1">
              {successData.itemsAdded} item{successData.itemsAdded !== 1 ? 's' : ''} added to stock
            </h3>
            <p className="text-sm text-on-surface/50 mb-8">
              Bill saved and stock updated successfully.
            </p>

            <ul className="space-y-2 mb-8 text-left">
              {successData.items.map((item, idx) => (
                <li
                  key={idx}
                  className="flex justify-between items-center py-2 border-b border-outline-variant/10 last:border-0"
                >
                  <span className="text-sm text-on-surface">{item.name}</span>
                  <span className="text-sm font-mono text-on-surface/60">
                    +{item.quantity} {item.unit}
                  </span>
                </li>
              ))}
            </ul>

            <div className="flex flex-col gap-3">
              <button
                type="button"
                onClick={() => router.push('/inventory')}
                className="w-full py-3.5 bg-gradient-to-r from-primary to-primary-container text-on-primary font-bold text-sm rounded-lg hover:-translate-y-0.5 transition-all active:scale-95 flex items-center justify-center gap-2"
              >
                View inventory
                <span className="material-symbols-outlined text-lg">arrow_forward</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setState('idle')
                  setSuccessData(null)
                  setExtractedItems([])
                  setError(null)
                }}
                className="w-full py-3 text-on-surface/60 text-sm font-medium hover:text-on-surface transition-colors"
              >
                Scan another bill
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
```

- [ ] **Step 2: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/(app)/scanner/page.tsx
git commit -m "feat: add scanner page with 4-state OCR flow (idle/processing/confirming/success)"
```

---

## Task 12: Loading and error states

**Files:**
- Create: `app/(app)/scanner/loading.tsx`
- Create: `app/(app)/scanner/error.tsx`

- [ ] **Step 1: Create loading.tsx**

```typescript
// app/(app)/scanner/loading.tsx
export default function ScannerLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      <div className="h-8 w-48 bg-surface-container rounded-lg" />
      <div className="flex flex-col lg:flex-row gap-8">
        <div className="flex-1 h-[400px] bg-surface-container-low rounded-xl" />
        <div className="flex-[1.5] h-[400px] bg-surface-container-low rounded-xl" />
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Create error.tsx**

```typescript
// app/(app)/scanner/error.tsx
'use client'
// Client component: error boundary requires useEffect

export default function ScannerError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] text-center space-y-4">
      <span
        className="material-symbols-outlined text-[48px] text-error"
        style={{ fontVariationSettings: "'FILL' 0" }}
      >
        error
      </span>
      <h3 className="text-xl font-semibold text-on-surface">Scanner unavailable</h3>
      <p className="text-sm text-on-surface/60 max-w-xs">
        {error.message || 'Something went wrong loading the bill scanner.'}
      </p>
      <button
        type="button"
        onClick={reset}
        className="px-6 py-2.5 bg-gradient-to-r from-primary to-primary-container text-on-primary text-sm font-semibold rounded-lg hover:-translate-y-0.5 transition-all"
      >
        Try again
      </button>
    </div>
  )
}
```

- [ ] **Step 3: Verify build**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add app/(app)/scanner/loading.tsx app/(app)/scanner/error.tsx
git commit -m "feat: add scanner loading and error boundary components"
```

---

## Task 13: Full build verification + end-to-end test

- [ ] **Step 1: Run a clean build**

```bash
npm run build
```

Expected: exits with code 0. No TypeScript errors, no ESLint errors. Output shows:
- `app/(app)/scanner` route compiled
- `app/api/ocr/extract` route compiled
- `app/api/ocr/confirm` route compiled

- [ ] **Step 2: Run the migration if not already done**

If you skipped Task 6 step 2, run it now:
```bash
npx supabase db push
```
Or paste `supabase/migrations/005_bill_confirm_rpc.sql` into the Supabase SQL Editor.

- [ ] **Step 3: Start dev server**

```bash
npm run dev
```

- [ ] **Step 4: Test idle state**

Navigate to `http://localhost:3000/scanner`.

Expected:
- Page shows "Scan a Bill" heading with "Gemini Vision Active" pill
- Left panel shows upload zone with camera icon
- Right panel shows empty placeholder
- "Or paste bill text manually" textarea visible below upload zone

- [ ] **Step 5: Test file upload flow**

Upload a clear photo of any receipt or invoice.

Expected:
- State transitions to `processing`
- Three step indicators appear: "Reading image…", "AI extracting items…", "Matching to inventory…"
- Progress bar animates
- State transitions to `confirming` when done
- Items appear in the editable table on the right

- [ ] **Step 6: Test the confirmation table**

In the confirming state:
- Edit one item name → name should update in the input
- Change a quantity to empty → Confirm button should become disabled
- Restore the quantity → Confirm button enables
- Click "+ Add item manually" → new empty row appears
- Click × on a row → row is removed
- Fill in Supplier name and Date fields

- [ ] **Step 7: Test confirm flow**

Click "Confirm & Add to Stock →".

Expected:
- Button shows "Saving…"
- State transitions to `success` 
- Success screen shows item count and item list
- "View inventory →" button navigates to `/inventory`
- New items appear in inventory with updated stock levels

- [ ] **Step 8: Test fallback (optional)**

If you have a Gemini key configured in Settings:
- Temporarily clear the Gemini key in user settings
- Upload a bill
- Should show amber warning banner: "AI reading unavailable — showing basic scan instead."
- Should still extract items using Tesseract + rule-based parser

- [ ] **Step 9: Verify no security regressions**

Check the network tab in browser DevTools:
- `POST /api/ocr/extract` response should NOT include any API keys
- `POST /api/ocr/confirm` response should contain only `{ success, bill_id, items_added }`
- No `org_id` or user data leaked in error responses

- [ ] **Step 10: Final commit**

```bash
git add .
git commit -m "feat: complete bill scanner OCR pipeline (Task 6)"
```

---

## Self-review against spec

### Spec coverage check

| Spec requirement | Task |
|-----------------|------|
| preprocessImage (validate, resize, greyscale, base64) | Task 3 |
| tesseractClient with onProgress callback | Task 4 |
| normaliseItems (clean names, unit normalisation, exact match, LLM fuzzy, Levenshtein fallback) | Task 5 |
| billVisionPrompt for Gemini | Task 2 |
| UNIT_ALIASES + normaliseUnit | Task 1 |
| /api/ocr/extract (session auth, Gemini vision, JSON parse, billParseFallback, normalise) | Task 7 |
| /api/ocr/confirm (session auth, Zod validate, storage upload, atomic RPC) | Task 8 |
| Migration 005: RPC + storage bucket + storage RLS policies | Task 6 |
| Scanner page: 4 states (idle/processing/confirming/success) | Task 11 |
| Upload zone: drag/drop, file input, manual text | Task 9 |
| ConfirmTable: editable rows, confidence colors, new-item badge, bottom bar | Task 10 |
| loading.tsx + error.tsx | Task 12 |
| BILL_IMAGES_BUCKET constant used (not hardcoded) | Already in constants.ts |
| org_id always from session, never from client body | Tasks 7, 8 |
| Zod validation on all server inputs | Tasks 7, 8 |
| All LLM calls through routeLLMTask | Tasks 5, 7 |
| D1: no direct current_stock update | RPC uses transactions only |
| D2: atomic multi-table write | Task 6 (RPC) |
| Never 500 on OCR extract | Task 7 (always 200 with fallback) |
| Quantities font-mono | Task 10 (ConfirmTable) |
| Confidence colors: >0.8 white, 0.4–0.8 amber border, new item indigo bg | Task 10 |
| Ambient shadow formula only | Task 10 |
| Success state with item list + "View inventory" + "Scan another" | Task 11 |

All spec requirements are covered.

### Type consistency check

- `NormalisedItem` defined in `lib/ocr/normaliseItems.ts`, imported by `ConfirmTable.tsx` and `page.tsx` ✓
- `ConfirmedItem` defined in `ConfirmTable.tsx`, used internally and passed to `page.tsx` via `onConfirm` ✓
- `BillMeta` defined in `ConfirmTable.tsx`, passed to `page.tsx` via `onConfirm` ✓
- `RawExtractedItem` defined in `normaliseItems.ts`, used in `extract/route.ts` ✓
- `PreprocessResult` defined in `preprocessImage.ts`, used in `page.tsx` ✓
- Router payload keys: `image_base64`, `mime_type`, `prompt`, `tesseract_text` — match `handleBillVision` in `router.ts` ✓
- Router payload keys for `item_normalise`: `extracted_names`, `existing_items` — match `handleItemNormalise` ✓
