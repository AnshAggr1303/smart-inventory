# CLAUDE.md — Smart Inventory
# Last updated: April 2026
# Version: Phase 1

---

## WHAT IS THIS FILE

This is the single source of truth for Claude Code.
Read this entire file before starting any task.
For deeper detail on any module, read the relevant
file in /docs/ — linked in each section below.

---

## 1. PROJECT OVERVIEW

Smart Inventory is a universal AI-powered inventory
management platform for small and medium businesses.
Any business that holds physical stock — restaurant,
pharmacy, kirana store, hotel, salon, factory — can
sign up, pick their industry, and get an intelligent
system that reads bills, tracks stock, runs recipes,
and operates AI agents that watch and act on their
behalf.

Users are non-technical. Every screen must be simple
enough for someone who has never used a SaaS tool.

Full detail: /docs/project-overview.md

---

## 2. TECH STACK — DO NOT DEVIATE

| Layer           | Technology                                          |
|-----------------|-----------------------------------------------------|
| Frontend        | Next.js 14 App Router, TypeScript (strict), Tailwind|
| UI components   | Stitch design system → /stitch/                     |
| Backend         | Next.js API Routes + Server Actions                 |
| Database        | Supabase (Postgres + Auth + Storage + Realtime)     |
| OCR             | Tesseract.js (client preprocessing) + Gemini 1.5   |
|                 | Flash (server vision)                               |
| LLM - fast      | Groq — round-robin across 3 user-provided keys      |
| LLM - vision    | Google Gemini Flash — 1 user-provided key           |
| LLM - fallback  | Rule-based logic — always implemented               |
| Auth            | Supabase Auth (email + Google OAuth)                |
| File storage    | Supabase Storage                                    |
| Validation      | Zod — all server-side input validation              |
| Deployment      | Vercel + Vercel Cron Jobs                           |

---

## 3. FOLDER STRUCTURE

/app
  /api/                    ← route handlers + cron endpoints
    /ocr/
    /llm/
    /agents/
      /reorder/run/
      /shrinkage/run/
      /forecast/run/
    /inventory/
    /recipes/
    /analytics/
  /(auth)/                 ← login, signup, reset-password
  /(onboarding)/           ← 3-step onboarding flow
  /(app)/                  ← all protected app screens
    /dashboard/
    /inventory/
    /inventory/[id]/
    /scanner/
    /recipes/
    /agents/
    /analytics/
    /settings/

/components/
  /ui/                     ← Stitch exported base components
  /shared/                 ← Sidebar, TopBar, CopilotBar
  /dashboard/
  /scanner/
  /recipes/
  /agents/

/lib/
  /supabase/               ← client.ts + server.ts helpers
  /llm/                    ← router.ts, groqClient.ts,
  /                           geminiClient.ts, prompts/
  /ocr/                    ← preprocessImage.ts,
  /                           tesseractClient.ts,
  /                           normaliseItems.ts
  /agents/                 ← reorderAgent.ts,
  /                           shrinkageAgent.ts,
  /                           forecastAgent.ts
  /recipes/                ← checkSufficiency.ts,
  /                           calculateCost.ts
  /crypto/                 ← encryptKey.ts, decryptKey.ts
  /units/                  ← convertUnit.ts
  /utils/                  ← formatQuantity.ts,
  /                           fuzzyMatch.ts,
  /                           industryTemplates.ts

/lib/constants.ts          ← ALL magic numbers live here
/types/                    ← all global TypeScript types
/hooks/                    ← custom React hooks
/docs/                     ← detailed module documentation
/stitch/                   ← Stitch design export (read-only)
/supabase/
  /migrations/             ← schema migration files

/middleware.ts             ← auth gate + onboarding gate
/vercel.json               ← cron job configuration

---

## 4. DATA MODEL — TABLE SUMMARY

Full SQL schemas, triggers, RLS policies, and seed data:
→ /docs/data-model.md
→ /supabase/migrations/001_initial_schema.sql

### Tables

| Table                | Purpose                                    |
|----------------------|--------------------------------------------|
| organisations        | One row per business                       |
| user_profiles        | Extends auth.users, holds org_id           |
| user_settings        | Encrypted API keys, notification prefs     |
| items                | Master item catalogue                      |
| transactions         | Every stock movement — the ledger          |
| bills                | Scanned or entered purchase bills          |
| recipes              | Recipe / formula definitions               |
| recipe_ingredients   | Ingredient lines inside each recipe        |
| suppliers            | Supplier contact + price history           |
| agent_actions        | All agent proposals and their outcomes     |
| unit_conversions     | Global unit multiplier lookup table        |

### Key relationships

organisations → user_profiles (many)
organisations → items (many)
organisations → recipes (many)
organisations → bills (many)
organisations → suppliers (many)
organisations → agent_actions (many)
items → transactions (many)
items → recipe_ingredients (many)
recipes → recipe_ingredients (many)
bills → transactions (many)

### The most important data rule

NEVER update items.current_stock directly.
ALWAYS insert a row into transactions.
A Postgres trigger updates current_stock atomically.
This is non-negotiable. See Rule D1.

### RLS pattern (all tables)

Every table is scoped by org_id.
Users can only read/write rows where org_id matches
their own organisation. No exceptions.

### Industry config

industry is stored as a lowercase string:
restaurant | pharmacy | retail | hotel |
manufacturing | other

Industry controls UI labels and seed templates only.
The data model is identical for all industries.

---

## 5. MODULE POINTERS

When working on a specific module, read its /docs/ file
before writing any code.

| Module              | Read this first                        |
|---------------------|----------------------------------------|
| Auth + onboarding   | /docs/auth-onboarding.md               |
| LLM router          | /docs/llm-router.md                    |
| OCR pipeline        | /docs/ocr-pipeline.md                  |
| Recipe engine       | /docs/recipe-engine.md                 |
| Agent system        | /docs/agent-system.md                  |
| Frontend / UI       | /docs/frontend-structure.md            |
| Database / schema   | /docs/data-model.md                    |

### Module summaries (read /docs/ for full detail)

AUTH + ONBOARDING
Use Supabase Auth (email + Google OAuth).
3-step onboarding: account → business profile → API keys.
Middleware gates all /(app)/* routes.
org_id always derived from authenticated session.
Keys encrypted with AES-256-GCM before any DB write.

LLM ROUTER
All LLM calls go through routeLLMTask() in
/lib/llm/router.ts — never call providers directly.
Groq: round-robin across 3 user keys, fast text tasks.
Gemini: single user key, vision + co-pilot chat.
Every task has a rule-based fallback. App never breaks
if LLM is unavailable.

OCR PIPELINE
4 stages: preprocess (client) → vision extract (Gemini,
server) → normalise + match (Groq) → user confirm.
All DB writes on confirm run in a single atomic RPC.
Tesseract is the fallback if Gemini is unavailable.

RECIPE ENGINE
Users define recipes/formulas with ingredients + units.
Deduction checks sufficiency first — never goes negative.
All deductions are atomic (single RPC for all ingredients).
After deduction, auto-check if any item hit reorder point.

AGENT SYSTEM
3 agents: Reorder, Shrinkage Detective, Demand Forecaster.
Agents create pending agent_actions — never act unilaterally.
Human approval required before any external action.
Triggered by events (stock changes) and Vercel Cron schedules.
Cron endpoints verify CRON_SECRET header — first line, always.

---

## 6. PHASE 1 SCOPE

### Building now ✅

- Auth + onboarding (3 steps)
- Main dashboard with live stock overview
- Bill scanner (OCR + confirm flow)
- Inventory management (add, edit, view items)
- Recipe / formula engine (define + deduct)
- Reorder agent (draft + approve flow)
- Shrinkage detection (weekly variance report)
- Demand forecaster (daily briefing)
- Basic analytics (stock flow, supplier spend)
- Natural language co-pilot (basic queries)
- Multi-unit conversion
- Expiry tracking
- Supplier price memory

### Not building yet ❌ (Phase 2)

- Team invites / multi-user per org
- WhatsApp integration
- POS / Swiggy / Zomato sync
- Voice entry
- Shelf vision camera
- Supplier negotiation agent
- Advanced reporting and exporting
- Mobile bottom tab bar

---

## 7. DESIGN SYSTEM

### Primary reference files (read before any UI work)

1. /stitch/indigo_ledger/DESIGN.md   ← ALWAYS read first
2. /stitch/{screen}/code.html        ← reference for that screen
3. /stitch/{screen}/screen.png       ← visual target

### Stitch screen → route mapping

| Stitch folder           | Route                        |
|-------------------------|------------------------------|
| landing_page            | / (marketing page)           |
| signup_onboarding       | /(onboarding)/               |
| main_dashboard          | /(app)/dashboard             |
| bill_scanner            | /(app)/scanner               |
| inventory_item_detail   | /(app)/inventory/[id]        |
| recipe_manager          | /(app)/recipes               |
| reorder_agent_panel     | /(app)/agents                |
| analytics_reports       | /(app)/analytics             |

One screen has no Stitch reference — build from design system:
/(app)/inventory  ← main inventory list page

### Critical design rules (from DESIGN.md)

COLORS — surface hierarchy:
- Global background:      #FAFAEF  (surface)
- Sidebar + content area: #F5F4EA  (surface-container-low)
- Cards + inputs:         #FFFFFF  (surface-container-lowest)
- Primary:                #1E0CDE
- Primary container:      #3D3BF3
- On-surface (text):      #1B1C16  — NEVER use #000000
- Outline variant:        #C6C4D9

THE NO-LINE RULE:
Never use 1px borders to separate sections.
Separate content through background color shifts only.
Ghost border (#C6C4D9 at 15% opacity) is the only
permitted fallback for low-contrast situations.

ELEVATION — tonal layering only:
No standard drop shadows.
Ambient shadow formula when floating state is needed:
  0 12px 32px -4px rgba(27, 28, 22, 0.06)
Cards lift by sitting on a darker surface beneath them.

TYPOGRAPHY — Inter throughout:
- Display:    3.5rem / 700 — page anchors only
- Heading:    1.5–2rem / 600
- Body:       0.875rem / 400
- Label:      uppercase + 0.05em tracking
- Quantities: Inter Mono always — signals "Data Mode"

BUTTONS:
- Primary: gradient fill #1E0CDE → #3D3BF3, 8px radius
- Secondary: surface-container-lowest + ghost border
- Hover: shift up 1px + slight ambient shadow increase

INPUTS:
- Background: surface-container-lowest, no border
- Focus: 2px ring of #E1E0FF (soft glow, not harsh)

STATUS PILLS:
- Low stock:   #FFDDB8 background (tertiary-fixed)
- Processing:  #A3A6FE background (secondary-container)
- AI insights: amber/tertiary tokens always

GLASSMORPHISM (floating elements only):
- surface-container-lowest at 80% opacity
- backdrop-filter: blur(12px)
- Use for: command palette, tooltips, insight toasts

STITCH CONVERSION RULE:
Each code.html is a design reference, not copy-paste.
For every screen:
1. Read code.html + screen.png carefully
2. Rebuild as proper Next.js page + components
3. Match visual design exactly
4. Replace hardcoded data with real Supabase data
5. Wire all interactions to Server Actions
Never copy HTML directly into JSX files.

---

## 8. ENVIRONMENT VARIABLES

### Public (safe — NEXT_PUBLIC_ prefix allowed)
NEXT_PUBLIC_SUPABASE_URL
NEXT_PUBLIC_SUPABASE_ANON_KEY

### Server only (never expose to client)
SUPABASE_SERVICE_ROLE_KEY
ENCRYPTION_SECRET          ← 32-char random string
CRON_SECRET                ← random string for cron auth

### Not in env vars (stored in DB per user, encrypted)
Groq API keys (up to 3 per user)
Gemini API key (1 per user)

---

## 9. RULES + CONSTRAINTS

Read every rule before starting any task.
These are non-negotiable. No exceptions.

---

### RULE GROUP 1 — Security

S1. Never expose API keys to the client.
    Keys are decrypted only inside Server Actions
    or API route handlers. Never in:
    - Client components
    - Browser responses
    - Error messages
    - Console logs
    - NEXT_PUBLIC_ env vars

S2. Never trust org_id or user_id from the client.
    Always derive from authenticated session:
```typescript
    const { data: { user } } = await supabase.auth.getUser()
    const { data: profile } = await supabase
      .from('user_profiles')
      .select('org_id')
      .eq('id', user.id)
      .single()
    const org_id = profile.org_id
```

S3. Never bypass Row Level Security.
    Never use service role key for standard operations.
    If a query needs RLS disabled, the query is wrong.

S4. Never log sensitive data.
    No keys, no org_id + user data together,
    no bill contents, no stack traces to client.
    Server-side structured logging only:
    { event, timestamp, latency_ms, success }

S5. Cron endpoints must verify CRON_SECRET first.
```typescript
    if (req.headers.get('authorization') !==
        `Bearer ${process.env.CRON_SECRET}`) {
      return Response.json({ error: 'Unauthorized' },
        { status: 401 })
    }
```
    This is the FIRST line in every cron handler.
    Before any DB query. Before any logging.

S6. Encrypt before storing, decrypt only at use.
    AES-256-GCM for all API keys.
    Never cache decrypted keys in module scope
    or any persistent store.

S7. Validate all inputs server-side with Zod.
    Client validation is UX only — zero security value.
    Every Server Action and API route validates
    independently using Zod schemas.

---

### RULE GROUP 2 — Data integrity

D1. Never update items.current_stock directly.
    Always insert a transaction row.
    Postgres trigger handles current_stock atomically.
```typescript
    // WRONG — never do this
    supabase.from('items')
      .update({ current_stock: newValue })

    // CORRECT — always do this
    supabase.from('transactions')
      .insert({ item_id, quantity, type, unit, ... })
```

D2. All multi-step DB operations must be atomic.
    Use Supabase RPC (Postgres function) for any
    operation that writes to more than one table.
    Affected: bill confirm, recipe deduct, onboarding.
    Never use sequential awaits for related writes.

D3. Stock never goes below zero.
    Deduction is blocked if any ingredient would
    go negative. "Record anyway" escape hatch sets
    stock to 0, never below.

D4. Every transaction needs type + source.
    type is mandatory. bill_id, recipe_id, or
    agent_action_id must be populated where applicable.
    Only 'adjustment' and 'wastage' types can have
    no source — they require a mandatory note.

D5. Never hard delete audit records.
    transactions, bills, recipes, agent_actions
    are permanent. Use is_archived or status fields.

D6. Always match on name_normalised.
    Never compare raw item names.
    Always use the generated name_normalised column.

---

### RULE GROUP 3 — TypeScript

T1. Strict mode always.
    tsconfig.json must have strict: true,
    noUncheckedIndexedAccess: true,
    noImplicitReturns: true.

T2. No any types. Ever.
    Use unknown and narrow it. Wrap third-party
    any in typed functions immediately.

T3. Use generated Supabase types.
    Run: supabase gen types typescript > /types/supabase.ts
    Use Database types for all query results.

T4. Explicit return types on all Server Actions.
```typescript
    async function createItem(
      input: CreateItemInput
    ): Promise<{ success: true; id: string }
              | { success: false; error: string }>
```

T5. Shared types live in /types/ only.
    Types used in more than one file go in /types/.

---

### RULE GROUP 4 — Next.js conventions

N1. Server Components by default.
    Add "use client" only when genuinely needed.
    Every "use client" file must have a comment:
    // Client component: reason here

N2. Prefer Server Actions over API routes.
    API routes only for: webhooks, external endpoints,
    streaming responses.

N3. Never use useEffect for data fetching.
    Server Components fetch on server.
    Client Components use SWR for fresh data.

N4. Every data route needs loading.tsx + error.tsx.
    No page ever shows a blank screen.

N5. Use next/image for all images.
    Never use raw <img> tags.

N6. Server-only env vars never in client components.
    Next.js build error on violation — never suppress.

---

### RULE GROUP 5 — LLM usage

L1. All LLM calls go through routeLLMTask() only.
    Never import groqClient or geminiClient directly
    in feature code. Always use the router.

L2. Always handle LLM failures gracefully.
    Every feature works (degraded) if LLM fails.
    Never let an LLM error crash a user flow.

L3. Never trust raw LLM output.
    Always parse + validate with Zod before any
    DB write. Treat every LLM response as untrusted.
```typescript
    try {
      parsed = schema.parse(JSON.parse(llmResponse))
    } catch {
      parsed = ruleBasisFallback(rawText)
    }
```

L4. No PII in LLM prompts beyond what is necessary.
    Bill contents are acceptable (needed for feature).
    Never include emails, passwords, or unrelated
    personal data in any prompt.

L5. All prompts live in /lib/llm/prompts/ as typed
    template functions. Never inline prompt strings
    in feature code.

---

### RULE GROUP 6 — Design system

U1. Read /stitch/indigo_ledger/DESIGN.md before
    building any UI component. No exceptions.

U2. Convert Stitch HTML to React properly.
    code.html is a reference. Rebuild as Next.js.
    Never copy-paste HTML into JSX.

U3. No 1px borders between sections.
    Separate content through background color shifts.
    This is the core "no-line" rule from DESIGN.md.

U4. Never use #000000 for text.
    Always use on-surface: #1B1C16.

U5. Quantities always use Inter Mono (font-mono).
    Every stock number, quantity, price, measurement.

U6. No standard drop shadows.
    Use ambient shadow formula only:
    0 12px 32px -4px rgba(27, 28, 22, 0.06)

U7. Status colors are fixed — never invent new ones.
    Low stock:  #FFDDB8 pill
    Processing: #A3A6FE pill
    AI insight: amber/tertiary tokens

U8. Every list + table needs an empty state.
    Icon (48px) + heading + subline + action button.
    Never show a blank area or plain "no items" text.

U9. Every destructive action needs a confirm dialog.
    State clearly what will happen. No browser
    alert() or confirm() — use modal dialogs only.

---

### RULE GROUP 7 — Code quality

Q1. No commented-out code. Delete it.

Q2. No TODO comments. Either build it or document
    it in /docs/phase2.md.

Q3. Functions do one thing.
    Over 60 lines → probably needs splitting.

Q4. Error messages must be actionable.
    Not: "Something went wrong."
    Yes: "Scan failed. Try a clearer photo or
         enter items manually."

Q5. No magic numbers or strings in feature code.
    All constants live in /lib/constants.ts with
    a comment explaining the value and why.

Q6. Key constants that must exist in constants.ts:
    OCR_CONFIDENCE_THRESHOLD     = 0.6
    OCR_MAX_FILE_SIZE_MB         = 10
    CRITICAL_STOCK_THRESHOLD     = 0.2
    STOCK_DECIMAL_PLACES         = 4
    DISPLAY_DECIMAL_PLACES       = 2
    SHRINKAGE_FLAG_THRESHOLD_PCT = 5
    SHRINKAGE_CRITICAL_PCT       = 15
    REORDER_LEAD_TIME_DAYS       = 3
    FORECAST_HORIZON_DAYS        = 7
    GROQ_KEY_COUNT               = 3
    DEMAND_LOOKBACK_DAYS         = 30
    EXPIRY_WARNING_DAYS          = 3

---

### RULE GROUP 8 — File discipline

F1. Never create files outside the defined structure.
    Update Section 3 of this file first if a new
    folder is genuinely needed.

F2. Feature code stays in feature folders.
    /lib/utils/ is for truly generic utilities only.

F3. One component per file.

F4. No index.ts barrel files. Ever.
    Always import from the specific file path.

---

### RULE GROUP 9 — When uncertain

Follow this order:

1. Check this CLAUDE.md for a rule covering the case
2. Check the relevant /docs/ module file
3. Check the Stitch screen.png + code.html
4. Check /stitch/indigo_ledger/DESIGN.md
5. Choose the simpler option
6. If security or data integrity is involved →
   stop and ask. Never guess on Rules S or D.

---

### THE 10 RULES TO READ EVERY SESSION

1.  Never expose API keys to client (S1)
2.  Never trust org_id from client (S2)
3.  Never update current_stock directly (D1)
4.  All multi-step DB ops must be atomic (D2)
5.  Never let LLM output hit DB unvalidated (L3)
6.  All LLM calls go through the router (L1)
7.  Stitch HTML is a reference, not copy-paste (U2)
8.  Read DESIGN.md before any UI work (U1)
9.  All constants in /lib/constants.ts (Q5)
10. When uncertain, choose simpler (Group 9)