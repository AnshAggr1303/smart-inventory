# Smart Inventory

A universal AI-powered inventory management platform for small and medium businesses. Built for restaurants, pharmacies, kirana stores, hotels, and manufacturing units — any business that holds physical stock.

> Built in public. Inspired by a friend who runs 2 food shops and counts stock in a notebook every night.

---

## What it does

- **OCR bill scanning** — photograph any purchase bill, items are extracted and added to stock automatically
- **Recipe engine** — define recipes once (Veg Roll = 100g paneer + 50g maida + 2g mayo), sell a dish, ingredients deduct automatically
- **Live stock tracking** — real-time dashboard showing current stock, low stock alerts, recent movements
- **AI agents** — reorder agent, shrinkage detective, and demand forecaster watch your stock 24/7 and propose actions for your approval
- **Natural language co-pilot** — ask "how much paneer do I have?" and get an instant answer
- **Multi-industry** — same platform works for food, pharma, retail, hotels, and manufacturing with industry-specific templates

---

## Tech stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 (App Router), TypeScript (strict), TailwindCSS |
| UI | Stitch design system (Google) |
| Backend | Next.js API Routes + Server Actions |
| Database | Supabase (Postgres + Auth + Storage + Realtime) |
| OCR | Tesseract.js (client) + Gemini 1.5 Flash (server) |
| LLM — fast | Groq (round-robin across 3 keys) |
| LLM — vision | Google Gemini 2.0 Flash |
| Auth | Supabase Auth (email + Google OAuth) |
| Deployment | Vercel |

---

## Free to run — BYOK model

Smart Inventory is free to use. You bring your own API keys:

- **Groq API key** — free at [console.groq.com](https://console.groq.com). Powers text parsing and AI agents.
- **Gemini API key** — free at [aistudio.google.com](https://aistudio.google.com). Powers bill photo reading and co-pilot chat.

Keys are encrypted with AES-256-GCM before being stored. All AI calls run server-side. Keys are never visible in the browser.

---

## Getting started

### Prerequisites

- Node.js 20+
- A Supabase project (free tier works)
- A Vercel account (free tier works)

### 1. Clone the repo

```bash
git clone https://github.com/YOUR_USERNAME/smart-inventory.git
cd smart-inventory
```

### 2. Install dependencies

```bash
npm install
```

### 3. Set up environment variables

Create a `.env.local` file in the project root:

```bash
# Public — safe to expose
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

# Server only — never expose to client
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
ENCRYPTION_SECRET=your_32_character_random_string
CRON_SECRET=your_random_cron_secret
```

Generate `ENCRYPTION_SECRET`:
```bash
node -e "console.log(require('crypto').randomBytes(16).toString('hex'))"
```

### 4. Set up the database

Install Supabase CLI and link your project:
```bash
npm install supabase --save-dev
npx supabase login
npx supabase link --project-ref YOUR_PROJECT_ID
```

Run all migrations:
```bash
npx supabase db push
```

Or paste each file from `supabase/migrations/` into the Supabase SQL Editor manually.

### 5. Create Supabase Storage bucket

In your Supabase dashboard go to Storage → New bucket:
- Name: `bill-images`
- Public: No (private)

### 6. Run the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### 7. Sign up and complete onboarding

1. Create an account
2. Pick your industry
3. Paste your free Groq and Gemini API keys
4. Start scanning bills and tracking stock

---

## Project structure

```
/app
  /api/                  ← all API route handlers
  /(auth)/               ← login, signup, reset password
  /(onboarding)/         ← 3-step onboarding flow
  /(app)/                ← all protected app screens
    /dashboard/
    /inventory/
    /scanner/
    /recipes/
    /agents/
    /analytics/
    /settings/

/components/
  /ui/                   ← Stitch base components
  /shared/               ← Sidebar, TopBar, CopilotBar

/lib/
  /supabase/             ← client + server helpers
  /llm/                  ← LLM router, Groq, Gemini
  /ocr/                  ← Tesseract + parsing
  /agents/               ← agent logic
  /recipes/              ← recipe engine
  /crypto/               ← key encryption
  /units/                ← unit conversion

/docs/                   ← detailed module documentation
/stitch/                 ← design references (read-only)
/supabase/migrations/    ← database migration files
/types/                  ← TypeScript interfaces
```

---

## Database migrations

All migrations are in `/supabase/migrations/` in order:

| File | What it does |
|---|---|
| `001_initial_schema.sql` | All 11 tables, indexes, unit conversion seed data |
| `002_triggers_and_rls.sql` | Stock trigger, user profile trigger, RLS policies |
| `003_fix_org_insert_policy.sql` | Fixes RLS for onboarding org creation |
| `004_item_rpc.sql` | Atomic item creation with initial stock |
| `005_bill_confirm_rpc.sql` | Atomic bill confirmation + storage policies |
| `006_recipe_engine.sql` | Recipe deduction RPC + selling_price column |

---

## AI agents

Three autonomous agents run in the background:

**Reorder Agent** — watches stock 24/7. When an item drops below the reorder point, drafts a supplier message and creates a pending action for your approval.

**Shrinkage Detective** — weekly variance analysis. Compares expected stock (purchases minus recipe deductions) against actual stock. Flags unexplained losses in rupees.

**Demand Forecaster** — analyses 30 days of consumption patterns. Predicts next 7-14 days of stock needs and detects upcoming demand spikes.

All agents require human approval before any action is taken.

---

## Supported industries

| Industry | Use case |
|---|---|
| Restaurant / Cloud Kitchen | Recipes, ingredients, daily stock |
| Pharmacy | Medicines, batches, expiry tracking |
| Retail / Kirana | SKUs, suppliers, reorder points |
| Hotel | Housekeeping, F&B, minibar |
| Manufacturing | Raw materials, BOMs, production runs |
| Other | Custom setup |

---

## Environment variables reference

| Variable | Required | Description |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Yes | Your Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Yes | Supabase anon/public key |
| `SUPABASE_SERVICE_ROLE_KEY` | Yes | Supabase service role key (server only) |
| `ENCRYPTION_SECRET` | Yes | 32-char string for AES-256-GCM key encryption |
| `CRON_SECRET` | Yes | Secret for Vercel Cron Job authentication |

User API keys (Groq, Gemini) are stored encrypted in the database per user — not in environment variables.

---

## Deploying to Vercel

```bash
npx vercel
```

Add all environment variables from `.env.local` to your Vercel project settings.

Vercel Cron Jobs are configured in `vercel.json` — they trigger the AI agents on schedule automatically.

---

## Phase 2 roadmap

- WhatsApp integration for bill entry and reorder messages
- POS / Swiggy / Zomato sync for automatic recipe deductions
- Voice stock entry
- Shelf vision camera for physical audit
- Supplier negotiation agent
- Team invites / multi-user per org
- Advanced reporting and export

---

## Built by

[@aaahhhhhh_nsh](https://x.com/aaahhhhhh_nsh) — building in public.

Inspired by a friend who runs 2 food shops and counts stock in a notebook every single night.

---

## License

MIT