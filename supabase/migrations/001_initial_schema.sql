-- ============================================================
-- 001_initial_schema.sql
-- Smart Inventory — initial schema
-- Tables, generated columns, indexes, unit_conversions seed
-- ============================================================

-- ============================================================
-- Table 1 — organisations
-- ============================================================
create table organisations (
  id          uuid        primary key default gen_random_uuid(),
  name        text        not null,
  industry    text        not null default 'other',
              -- values: restaurant | pharmacy | retail |
              --         hotel | manufacturing | other
  city        text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

-- ============================================================
-- Table 2 — user_profiles
-- Extends auth.users. Created automatically via trigger.
-- ============================================================
create table user_profiles (
  id                  uuid        primary key references auth.users(id),
  org_id              uuid        references organisations(id),
  full_name           text,
  role                text        default 'owner',
                      -- values: owner | staff (Phase 2)
  onboarding_complete boolean     default false,
  created_at          timestamptz default now()
);

create index idx_user_profiles_org_id on user_profiles(org_id);

-- ============================================================
-- Table 3 — user_settings
-- One row per user — encrypted API keys + notification prefs.
-- ============================================================
create table user_settings (
  id              uuid        primary key default gen_random_uuid(),
  user_id         uuid        references user_profiles(id) unique,
  org_id          uuid        references organisations(id),

  -- Groq keys: AES-256-GCM encrypted JSON array of 3 strings
  groq_keys       text,
  groq_key_index  int         default 0,
                  -- 0 | 1 | 2 — current active key index

  -- Gemini key: AES-256-GCM encrypted string
  gemini_key      text,

  -- Notification preferences
  notify_email    boolean     default true,
  notify_push     boolean     default false,

  created_at      timestamptz default now(),
  updated_at      timestamptz default now()
);

-- ============================================================
-- Table 4 — suppliers
-- Supplier contact info + running spend stats.
-- ============================================================
create table suppliers (
  id               uuid        primary key default gen_random_uuid(),
  org_id           uuid        references organisations(id) not null,

  name             text        not null,
  name_normalised  text        generated always as (lower(trim(name))) stored,

  phone            text,
  email            text,
  address          text,

  -- Running stats updated by triggers
  total_orders     int         default 0,
  total_spend      numeric(14,2) default 0,

  notes            text,
  is_active        boolean     default true,
  created_at       timestamptz default now(),
  updated_at       timestamptz default now()
);

create index idx_suppliers_org_id         on suppliers(org_id);
create index idx_suppliers_name_normalised on suppliers(org_id, name_normalised);

-- ============================================================
-- Table 5 — items
-- Master catalogue. current_stock managed by trigger only.
-- ============================================================
create table items (
  id                   uuid          primary key default gen_random_uuid(),
  org_id               uuid          references organisations(id) not null,

  name                 text          not null,
  name_normalised      text          generated always as (lower(trim(name))) stored,

  category             text,
  -- e.g. dairy | grain | medicine | cleaning | raw-material

  -- Stock quantity — updated exclusively by the
  -- update_item_stock trigger on transactions.
  current_stock        numeric(12,4) default 0,
  unit                 text          not null,
  -- base unit: g | kg | ml | l | pcs | tabs | sheets

  -- Reorder settings
  reorder_point        numeric(12,4) default 0,
  reorder_qty          numeric(12,4) default 0,

  -- Cost tracking — updated from latest bill
  cost_per_unit        numeric(12,4),

  -- Expiry tracking (optional)
  track_expiry         boolean       default false,
  earliest_expiry      date,

  -- Preferred supplier (nullable)
  preferred_supplier_id uuid          references suppliers(id),

  is_archived          boolean       default false,
  created_at           timestamptz   default now(),
  updated_at           timestamptz   default now()
);

create index idx_items_org_id          on items(org_id);
create index idx_items_name_normalised  on items(org_id, name_normalised);

-- ============================================================
-- Table 6 — bills
-- One row per scanned or manually entered purchase bill.
-- ============================================================
create table bills (
  id            uuid          primary key default gen_random_uuid(),
  org_id        uuid          references organisations(id) not null,

  supplier_id   uuid          references suppliers(id),
  supplier_name text,
  -- raw name from OCR when supplier not yet matched

  bill_date     date,
  bill_number   text,

  -- Raw OCR output stored for audit
  raw_ocr_text  text,

  -- Parsed line items as JSONB array.
  -- Each element: { name, qty, unit, price_per_unit, total_price,
  --                 matched_item_id, confidence_score }
  parsed_items  jsonb,

  total_amount  numeric(12,2),
  status        text          default 'pending',
  -- values: pending | confirmed | rejected

  image_url     text,
  created_by    uuid          references user_profiles(id),
  confirmed_at  timestamptz,
  created_at    timestamptz   default now()
);

create index idx_bills_org_id     on bills(org_id);
create index idx_bills_created_at on bills(org_id, created_at desc);

-- ============================================================
-- Table 7 — recipes
-- Recipe / formula definitions. Ingredients in recipe_ingredients.
-- ============================================================
create table recipes (
  id          uuid          primary key default gen_random_uuid(),
  org_id      uuid          references organisations(id) not null,

  name        text          not null,
  category    text,
  -- e.g. main course | medicine | cleaning kit

  yield_qty   numeric(12,4) default 1,
  yield_unit  text          default 'portion',

  notes       text,
  is_archived boolean       default false,
  created_at  timestamptz   default now(),
  updated_at  timestamptz   default now()
);

create index idx_recipes_org_id on recipes(org_id);

-- ============================================================
-- Table 8 — recipe_ingredients
-- Each row is one ingredient line inside a recipe.
-- ============================================================
create table recipe_ingredients (
  id              uuid          primary key default gen_random_uuid(),
  org_id          uuid          references organisations(id) not null,
  recipe_id       uuid          references recipes(id) not null,
  item_id         uuid          references items(id) not null,

  quantity        numeric(12,4) not null,
  -- quantity of this item needed per 1 yield of the recipe

  unit            text          not null,

  unit_multiplier numeric(12,6) default 1,
  -- multiplier to convert recipe unit to item base unit

  created_at      timestamptz   default now()
);

create index idx_recipe_ingredients_recipe_id on recipe_ingredients(recipe_id);
create index idx_recipe_ingredients_item_id   on recipe_ingredients(item_id);

-- ============================================================
-- Table 9 — agent_actions
-- All agent proposals. Append-only — never updated or deleted.
-- ============================================================
create table agent_actions (
  id            uuid        primary key default gen_random_uuid(),
  org_id        uuid        references organisations(id) not null,

  agent_type    text        not null,
  -- values: reorder | shrinkage | demand_forecast

  status        text        default 'pending',
  -- values: pending | approved | rejected | executed | failed

  title         text        not null,
  description   text,

  payload       jsonb,
  -- reorder:         { item_id, qty, unit, supplier_id, estimated_cost }
  -- shrinkage:       { item_id, expected_qty, actual_qty, variance }
  -- demand_forecast: { item_id, predicted_qty, period, confidence }

  triggered_at  timestamptz default now(),
  reviewed_by   uuid        references user_profiles(id),
  reviewed_at   timestamptz,
  executed_at   timestamptz,
  error_message text,

  created_at    timestamptz default now()
);

create index idx_agent_actions_org_id on agent_actions(org_id);
create index idx_agent_actions_status on agent_actions(org_id, status);

-- ============================================================
-- Table 10 — transactions
-- Every stock movement. The ledger. Never delete.
-- current_stock updated atomically via trigger.
-- ============================================================
create table transactions (
  id              uuid          primary key default gen_random_uuid(),
  org_id          uuid          references organisations(id) not null,
  item_id         uuid          references items(id) not null,

  type            text          not null,
  -- values:
  --   bill_addition     — stock added from a scanned bill
  --   manual_addition   — stock added manually
  --   recipe_deduction  — stock removed due to recipe usage
  --   manual_deduction  — stock removed manually
  --   adjustment        — physical count correction
  --   wastage           — marked as wasted/expired

  quantity        numeric(12,4) not null,
  -- positive for additions, negative for deductions

  unit            text          not null,

  unit_multiplier numeric(12,6) default 1,
  -- multiplier to convert this transaction's unit to item base unit
  -- e.g. transaction unit = kg, item unit = g → multiplier = 1000

  cost_per_unit   numeric(12,4),

  -- Source references (all nullable)
  bill_id         uuid          references bills(id),
  recipe_id       uuid          references recipes(id),
  agent_action_id uuid          references agent_actions(id),

  note            text,
  performed_by    uuid          references user_profiles(id),
  created_at      timestamptz   default now()
);

create index idx_transactions_org_id     on transactions(org_id);
create index idx_transactions_item_id    on transactions(item_id);
create index idx_transactions_created_at on transactions(org_id, created_at desc);

-- ============================================================
-- Table 11 — unit_conversions
-- Global read-only reference table. No org_id.
-- ============================================================
create table unit_conversions (
  id          uuid           primary key default gen_random_uuid(),
  from_unit   text           not null,
  to_unit     text           not null,
  multiplier  numeric(16,8)  not null,
  -- to convert: value × multiplier gives to_unit result

  unique(from_unit, to_unit)
);

-- ============================================================
-- unit_conversions seed data
-- Insert once. These values never change.
-- ============================================================
insert into unit_conversions (from_unit, to_unit, multiplier) values
  -- Mass: kg ↔ g
  ('kg',   'g',    1000.00000000),
  ('g',    'kg',      0.00100000),

  -- Volume: l ↔ ml
  ('l',    'ml',   1000.00000000),
  ('ml',   'l',       0.00100000),

  -- Mass: lb ↔ g
  ('lb',   'g',    453.59237000),
  ('g',    'lb',     0.00220462),

  -- Mass: oz ↔ g
  ('oz',   'g',     28.34952313),
  ('g',    'oz',     0.03527396),

  -- Volume: tbsp ↔ ml
  ('tbsp', 'ml',    14.78676478),
  ('ml',   'tbsp',   0.06762805),

  -- Volume: tsp ↔ ml
  ('tsp',  'ml',     4.92892159),
  ('ml',   'tsp',    0.20288414),

  -- Volume: cup ↔ ml
  ('cup',  'ml',   236.58823650),
  ('ml',   'cup',    0.00422675),

  -- Mass: kg ↔ lb
  ('kg',   'lb',     2.20462262),
  ('lb',   'kg',     0.45359237),

  -- Mass: kg ↔ oz
  ('kg',   'oz',    35.27396195),
  ('oz',   'kg',     0.02834952),

  -- Volume: l ↔ tbsp
  ('l',    'tbsp',  67.62804511),
  ('tbsp', 'l',      0.01478676),

  -- Volume: l ↔ tsp
  ('l',    'tsp',  202.88413621),
  ('tsp',  'l',      0.00492892),

  -- Volume: l ↔ cup
  ('l',    'cup',    4.22675284),
  ('cup',  'l',      0.23658824),

  -- Pieces (identity — for completeness)
  ('pcs',  'pcs',    1.00000000),
  ('tabs', 'tabs',   1.00000000),
  ('sheets','sheets',1.00000000);
