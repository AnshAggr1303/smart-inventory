## SECTION 5: OCR PIPELINE MODULE

---

### Overview

The OCR pipeline converts a bill photo into confirmed stock
transactions. It has 4 stages:

  Stage 1 — Image preprocessing (client-side, Tesseract.js)
  Stage 2 — Vision extraction (server-side, Gemini 1.5 Flash)
  Stage 3 — Text parsing + item normalisation (server, Groq)
  Stage 4 — User confirmation + transaction creation (server)

The user only sees stage 4 — a clean table of extracted items
they can edit before confirming. Everything else happens
automatically in the background.

---

### Stage 1 — Image preprocessing (client-side)

Before sending the image to the server, preprocess it in the
browser to improve OCR accuracy and reduce payload size.
```typescript
// /lib/ocr/preprocessImage.ts
// Runs in the browser only — never on server

async function preprocessImage(file: File): Promise<{
  base64: string
  mimeType: 'image/jpeg' | 'image/png'
  originalSize: number
  processedSize: number
}>
```

Preprocessing steps in order:
1. Validate file type — accept jpg, png, pdf, webp only.
   Reject anything else with a clear error message.
2. Validate file size — reject if over 10MB before processing.
3. Convert to canvas using browser Canvas API
4. Resize — if width > 1600px, scale down maintaining
   aspect ratio. Larger images do not improve OCR and slow
   everything down.
5. Convert to greyscale — improves Tesseract accuracy on
   printed bills significantly
6. Increase contrast — apply a simple contrast filter
   (CSS filter: contrast(1.4) on canvas)
7. Export as JPEG at 85% quality
8. Convert to base64 string for transmission

Run Tesseract.js on the preprocessed image in the browser
as a preliminary pass. This gives us raw text quickly while
the image is being uploaded to the server. Show a "Reading
bill..." progress indicator using Tesseract's progress
callback.
```typescript
// /lib/ocr/tesseractClient.ts
// Browser only

import Tesseract from 'tesseract.js'

async function extractTextClient(
  imageBase64: string,
  onProgress: (pct: number) => void
): Promise<string>
// Returns raw OCR text — messy, unstructured
// Used as a fast preview and as fallback if Gemini fails
```

---

### Stage 2 — Vision extraction (server-side, Gemini)

Send the preprocessed image to Gemini 1.5 Flash via the
LLM router. Gemini is significantly more accurate than
Tesseract alone for bill reading — it understands layout,
handles handwriting, and can read low-quality photos.

Server Action at: /app/(app)/scanner/actions.ts
```typescript
async function extractBillVision(
  imageBase64: string,
  mimeType: string,
  org_id: string,
  user_id: string
): Promise<string>
// Returns raw extracted text from Gemini
```

Gemini prompt for bill extraction:
```
You are reading a purchase bill or invoice image.
Extract ALL line items you can see.
Return ONLY a JSON array. No explanation, no markdown.
Each item must have exactly these fields:
{
  "name": "item name as written on bill",
  "quantity": numeric value only,
  "unit": "unit as written (kg, g, pcs, etc)",
  "price_per_unit": numeric or null if not visible,
  "total_price": numeric or null if not visible
}
If you cannot read a value clearly, use null.
Do not guess or invent values.
If the image is not a bill or is unreadable,
return an empty array: []
```

Parse the JSON response. If parsing fails (Gemini returned
non-JSON), fall back to the Tesseract text from stage 1
and proceed to stage 3.

---

### Stage 3 — Text parsing + item normalisation (Groq)

Takes the raw extracted items from stage 2 and:
1. Cleans up item names (remove codes, punctuation, extra
   spaces)
2. Normalises units (converts "KGS", "Kgs.", "kilogram"
   all to "kg")
3. Attempts to match each item to an existing item in the
   org's inventory using name_normalised
4. Assigns a confidence score (0 to 1) to each match
```typescript
// /lib/ocr/normaliseItems.ts

type RawExtractedItem = {
  name: string
  quantity: number | null
  unit: string | null
  price_per_unit: number | null
  total_price: number | null
}

type NormalisedItem = {
  raw_name: string
  clean_name: string
  quantity: number | null
  unit: string             // always normalised
  price_per_unit: number | null
  total_price: number | null
  matched_item_id: string | null
  matched_item_name: string | null
  confidence_score: number // 0 to 1
  is_new_item: boolean     // true if no match found in DB
}

async function normaliseExtractedItems(
  items: RawExtractedItem[],
  org_id: string,
  user_id: string
): Promise<NormalisedItem[]>
```

Matching logic (in order of priority):
1. Exact match on name_normalised → confidence 1.0
2. Groq fuzzy match — send all extracted names + all
   existing item names to Groq in one batch call, ask it
   to match them. Parse the response.
   Prompt returns: { extracted_name, matched_name,
   confidence } for each item
3. If Groq match confidence < 0.6 → treat as new item
4. If Groq unavailable → fallback to Levenshtein distance
   check in /lib/utils/fuzzyMatch.ts

Unit normalisation map (handle in code, not LLM):
```typescript
const UNIT_ALIASES: Record<string, string> = {
  'kgs': 'kg', 'kgs.': 'kg', 'kilogram': 'kg',
  'kilograms': 'kg', 'kilo': 'kg',
  'gms': 'g', 'gm': 'g', 'grams': 'g', 'gram': 'g',
  'ltr': 'l', 'ltrs': 'l', 'litre': 'l', 'litres': 'l',
  'liter': 'l', 'liters': 'l',
  'mls': 'ml', 'millilitre': 'ml', 'milliliter': 'ml',
  'pcs': 'pcs', 'piece': 'pcs', 'pieces': 'pcs',
  'nos': 'pcs', 'no': 'pcs', 'number': 'pcs',
  'tabs': 'tabs', 'tablet': 'tabs', 'tablets': 'tabs',
  'strips': 'strips', 'strip': 'strips',
  'pkts': 'pkt', 'packet': 'pkt', 'packets': 'pkt',
  'box': 'box', 'boxes': 'box', 'bxs': 'box',
}
```

---

### Stage 4 — User confirmation UI

After stages 1-3 complete, show the user a confirmation
table they can edit before anything is saved to the DB.

The confirmation UI must show:

For each extracted item:
- Item name (editable text input — pre-filled with
  clean_name)
- Matched to (dropdown — pre-selected if confidence > 0.6,
  otherwise shows "New item" with option to match manually)
- Quantity (editable number input)
- Unit (editable dropdown — normalised units only)
- Price per unit (editable number input, optional)
- Confidence indicator — green dot if > 0.8, amber if
  0.4-0.8, red if < 0.4

Special states:
- New item (is_new_item = true): row highlighted in indigo
  light bg. User can rename it before saving. A new item
  will be created in the items table on confirmation.
- Low confidence match (< 0.6): amber warning icon. Tooltip
  "We're not sure about this match — please verify"
- Missing quantity: red highlight on quantity field.
  Cannot confirm until quantity is filled in.

Bottom of confirmation UI:
- Supplier name input (pre-filled if recognised from bill)
- Bill date picker (pre-filled from today)
- Bill number input (optional)
- "Discard" ghost button — discards everything, no DB writes
- "Confirm and add to stock →" primary button

On confirm (Server Action):
1. Create a row in `bills` table with status 'confirmed'
2. For each new item (is_new_item = true):
   Create a row in `items` table
3. For each confirmed line item:
   Insert a row into `transactions` with:
   - type: 'bill_addition'
   - quantity: confirmed quantity (positive number)
   - unit: confirmed unit
   - unit_multiplier: from unit_conversions table
   - cost_per_unit: confirmed price
   - bill_id: the new bill's id
4. Update supplier stats if supplier matched
5. Postgres trigger updates items.current_stock
   automatically (see Section 2)
6. Show success toast: "Added X items to stock"
7. Redirect to /inventory

All 5 DB operations in step 1-4 must run inside a
Supabase transaction (rpc call) so they either all succeed
or all fail together. Never partially save a bill.

---

### Bill image storage

Before starting OCR processing, upload the original
(unprocessed) image to Supabase Storage.

Bucket: 'bill-images'
Path: {org_id}/{year}/{month}/{bill_id}.jpg
Access: private — only accessible via signed URL
Signed URL expiry: 1 hour (for display in confirmation UI)

Store the storage URL in bills.image_url.
The image is kept for audit purposes.
Never store the base64 string in the database.

---

### OCR error states (all must be handled gracefully)

| Error                    | User message                          |
|--------------------------|---------------------------------------|
| File too large (>10MB)   | "Please use an image under 10MB"      |
| Unsupported file type    | "Please upload a JPG, PNG, or PDF"    |
| Gemini key missing       | "Add your Gemini key in Settings      |
|                          |  to enable bill scanning"             |
| Gemini rate limit        | "AI reading unavailable right now.    |
|                          |  Showing basic scan instead."         |
|                          | (falls back to Tesseract result)      |
| Image unreadable         | "We couldn't read this bill clearly.  |
|                          |  Try a clearer photo or enter manually"|
| All items low confidence | Amber banner: "Low confidence —       |
|                          |  please review all items carefully"   |
| Network error            | "Upload failed. Please try again."    |
| Partial parse (some      | Show what was parsed, highlight       |
| items missing)           | empty rows in red for manual fill     |

---

### Files Claude Code must create for this module

/app/(app)/scanner/
  page.tsx              ← scanner UI, upload zone
  actions.ts            ← Server Actions for OCR flow
  ConfirmTable.tsx      ← editable confirmation table
  UploadZone.tsx        ← drag + drop upload component

/lib/ocr/
  preprocessImage.ts    ← client-side image preprocessing
  tesseractClient.ts    ← browser Tesseract wrapper
  normaliseItems.ts     ← item matching + unit normalisation
  fuzzyMatch.ts         ← Levenshtein fallback matcher

/lib/utils/
  unitAliases.ts        ← UNIT_ALIASES map