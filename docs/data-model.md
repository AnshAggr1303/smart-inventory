## SECTION 2: DATA MODEL

All data lives in Supabase (Postgres). Every table has RLS enabled.
Every table has `org_id uuid` as a foreign key to `organisations`.
Never query across org boundaries.

---

### Table 1 — organisations

Stores one row per business. Created during onboarding step 1.
```sql
create table organisations (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  industry      text not null default 'other',
                -- values: restaurant | pharmacy | retail |
                --         hotel | manufacturing | other
  city          text,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
```

---

### Table 2 — user_profiles

One row per user. Extends Supabase auth.users.
Created automatically after signup via a Supabase trigger.
```sql
create table user_profiles (
  id            uuid primary key references auth.users(id),
  org_id        uuid references organisations(id),
  full_name     text,
  role          text default 'owner',
                -- values: owner | staff (Phase 2)
  onboarding_complete boolean default false,
  created_at    timestamptz default now()
);
```

---

### Table 3 — user_settings

Stores encrypted API keys per user. One row per user.
```sql
create table user_settings (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid references user_profiles(id) unique,
  org_id        uuid references organisations(id),

  -- Groq keys stored as an encrypted JSON array of 3 strings
  -- e.g. ["enc_key1", "enc_key2", "enc_key3"]
  -- Round-robin index tracked in groq_key_index
  groq_keys     text,           -- AES-256 encrypted JSON array
  groq_key_index int default 0, -- 0, 1, or 2 — current active key

  -- Single Gemini key, AES-256 encrypted
  gemini_key    text,

  -- Notification preferences
  notify_email  boolean default true,
  notify_push   boolean default false,

  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
```

---

### Table 4 — items

Master list of every stockable item for an org.
This is the catalogue — not the stock count itself.
```sql
create table items (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organisations(id) not null,

  name            text not null,
  -- normalised lowercase name for dedup matching
  name_normalised text generated always as (lower(trim(name))) stored,

  category        text,
  -- e.g. dairy, grain, medicine, cleaning, raw-material

  -- Stock quantity tracking
  current_stock   numeric(12,4) default 0,
  unit            text not null,
  -- base unit for this item: g | kg | ml | l | pcs | tabs | sheets

  -- Reorder settings
  reorder_point   numeric(12,4) default 0,
  reorder_qty     numeric(12,4) default 0,
  -- suggested qty to order when reorder_point is hit

  -- Cost tracking
  cost_per_unit   numeric(12,4),
  -- cost in INR per base unit, updated from latest bill

  -- Expiry tracking (optional)
  track_expiry    boolean default false,
  earliest_expiry date,
  -- earliest expiry across all batches of this item

  -- Supplier
  preferred_supplier_id uuid,
  -- references suppliers(id), nullable

  -- Status
  is_archived     boolean default false,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);
```

---

### Table 5 — transactions

Every stock movement ever. This is the ledger.
Current stock = sum of all transaction quantities for an item.
Never update current_stock directly — always insert a transaction
and let a Postgres trigger or server function update it.
```sql
create table transactions (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references organisations(id) not null,
  item_id       uuid references items(id) not null,

  type          text not null,
  -- values:
  --   bill_addition   — stock added from a scanned bill
  --   manual_addition — stock added manually
  --   recipe_deduction — stock removed due to recipe usage
  --   manual_deduction — stock removed manually
  --   adjustment      — physical count correction
  --   wastage         — marked as wasted/expired

  quantity      numeric(12,4) not null,
  -- positive for additions, negative for deductions

  unit          text not null,
  -- unit used in this transaction (may differ from item base unit)

  unit_multiplier numeric(12,6) default 1,
  -- multiplier to convert this transaction's unit to item base unit
  -- e.g. if item unit is g and transaction unit is kg, multiplier = 1000

  cost_per_unit numeric(12,4),
  -- price at time of this transaction (from bill or manual)

  -- Source references (all nullable)
  bill_id       uuid,           -- references bills(id)
  recipe_id     uuid,           -- references recipes(id)
  agent_action_id uuid,         -- references agent_actions(id)

  note          text,
  performed_by  uuid references user_profiles(id),
  created_at    timestamptz default now()
);
```

---

### Table 6 — bills

One row per scanned or manually entered purchase bill.
```sql
create table bills (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organisations(id) not null,

  supplier_id     uuid,         -- references suppliers(id), nullable
  supplier_name   text,         -- raw name from OCR if not matched

  bill_date       date,
  bill_number     text,

  -- Raw OCR output stored for audit
  raw_ocr_text    text,

  -- Parsed line items stored as JSONB array
  -- Each item: { name, qty, unit, price_per_unit, total_price,
  --              matched_item_id, confidence_score }
  parsed_items    jsonb,

  total_amount    numeric(12,2),
  status          text default 'pending',
  -- values: pending | confirmed | rejected

  image_url       text,         -- Supabase Storage URL
  created_by      uuid references user_profiles(id),
  confirmed_at    timestamptz,
  created_at      timestamptz default now()
);
```

---

### Table 7 — recipes

Formula/recipe definitions. One row per recipe.
```sql
create table recipes (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references organisations(id) not null,

  name          text not null,
  category      text,
  -- e.g. main course, medicine, cleaning kit

  -- Display label varies by industry
  -- restaurant → "Recipe", pharmacy → "Formula",
  -- hotel → "Service kit" — handled in UI config, not DB

  yield_qty     numeric(12,4) default 1,
  yield_unit    text default 'portion',
  -- e.g. 1 portion, 1 tablet, 1 kit

  notes         text,
  is_archived   boolean default false,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
```

---

### Table 8 — recipe_ingredients

Each row is one ingredient line inside a recipe.
A recipe has many recipe_ingredients.
```sql
create table recipe_ingredients (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references organisations(id) not null,
  recipe_id     uuid references recipes(id) not null,
  item_id       uuid references items(id) not null,

  quantity      numeric(12,4) not null,
  -- quantity of this item needed per 1 yield of the recipe

  unit          text not null,
  -- unit for this ingredient in this recipe

  unit_multiplier numeric(12,6) default 1,
  -- multiplier to convert recipe unit to item base unit

  created_at    timestamptz default now()
);
```

---

### Table 9 — suppliers

Supplier contact and price history.
```sql
create table suppliers (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references organisations(id) not null,

  name          text not null,
  name_normalised text generated always as (lower(trim(name))) stored,

  phone         text,
  email         text,
  address       text,

  -- Running stats updated by triggers
  total_orders  int default 0,
  total_spend   numeric(14,2) default 0,

  notes         text,
  is_active     boolean default true,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
```

---

### Table 10 — agent_actions

Log of every action an agent has taken or proposed.
Human approval is required before any external action executes.
```sql
create table agent_actions (
  id              uuid primary key default gen_random_uuid(),
  org_id          uuid references organisations(id) not null,

  agent_type      text not null,
  -- values: reorder | shrinkage | demand_forecast

  status          text default 'pending',
  -- values: pending | approved | rejected | executed | failed

  -- What the agent decided
  title           text not null,
  -- short summary e.g. "Reorder 5kg Paneer from Ram Dairy"

  description     text,
  -- longer explanation of why the agent took this action

  payload         jsonb,
  -- structured action data — varies by agent type
  -- reorder: { item_id, qty, unit, supplier_id, estimated_cost }
  -- shrinkage: { item_id, expected_qty, actual_qty, variance }
  -- demand_forecast: { item_id, predicted_qty, period, confidence }

  -- Timestamps
  triggered_at    timestamptz default now(),
  reviewed_by     uuid references user_profiles(id),
  reviewed_at     timestamptz,
  executed_at     timestamptz,

  -- Error info if execution failed
  error_message   text,

  created_at      timestamptz default now()
);
```

---

### Table 11 — unit_conversions

Lookup table for unit conversion multipliers.
Used by recipe engine and transaction processing.
```sql
create table unit_conversions (
  id            uuid primary key default gen_random_uuid(),
  from_unit     text not null,
  to_unit       text not null,
  multiplier    numeric(16,8) not null,
  -- to convert from_unit to to_unit: value × multiplier
  -- e.g. kg → g: multiplier = 1000
  --      g → kg: multiplier = 0.001
  --      l → ml: multiplier = 1000

  unique(from_unit, to_unit)
);

-- Seed data (insert once, never changes)
-- kg ↔ g, l ↔ ml, lb ↔ g, oz ↔ g, tbsp ↔ ml, tsp ↔ ml, etc.
```

---

### Key relationships (mental map)
```
organisations
  └── user_profiles (many)
  └── user_settings (one per user)
  └── items (many)
        └── transactions (many) ← every stock movement
        └── recipe_ingredients (many) ← used in recipes
  └── recipes (many)
        └── recipe_ingredients (many)
  └── bills (many)
        └── transactions (many) ← one bill creates many
  └── suppliers (many)
  └── agent_actions (many)
```

---

### RLS policies (all tables follow this pattern)

Every table gets these two policies and nothing else in Phase 1:
```sql
-- Users can only see their org's data
create policy "org_select" on [table]
  for select using (org_id = (
    select org_id from user_profiles where id = auth.uid()
  ));

-- Users can only insert/update their org's data
create policy "org_write" on [table]
  for all using (org_id = (
    select org_id from user_profiles where id = auth.uid()
  ));
```

Exception: `unit_conversions` is a global read-only reference table.
It has no org_id and a single SELECT-for-all policy.

---

### Critical rules for working with the data model

- NEVER update `items.current_stock` directly in application code.
  Always insert a row into `transactions`. A Postgres trigger on
  the transactions table updates `items.current_stock` atomically.

- ALWAYS store quantities in the item's base unit in the
  `items.current_stock` column. Transactions can arrive in any
  unit but must store `unit_multiplier` so the trigger converts
  correctly.

- ALWAYS use `name_normalised` for item matching and dedup logic,
  never raw `name`.

- The `bills.parsed_items` JSONB must always include
  `matched_item_id` (nullable) and `confidence_score` (0-1) for
  every line. This powers the confirmation UI.

- `agent_actions` rows are append-only. Never update or delete
  them. Status transitions go:
  pending → approved → executed
  pending → rejected
  pending → executed (auto, if configured — Phase 2 only)