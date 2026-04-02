-- ============================================================
-- 002_triggers_and_rls.sql
-- Smart Inventory — triggers, functions, and RLS policies
-- ============================================================

-- ============================================================
-- TRIGGER FUNCTION 1 — update_item_stock
-- Fires after every INSERT on transactions.
-- Applies quantity × unit_multiplier to items.current_stock
-- atomically so current_stock is always the true running total.
-- Rule D1: the only place current_stock is ever written.
-- ============================================================
create or replace function update_item_stock()
returns trigger
language plpgsql
security definer
as $$
begin
  update items
  set
    current_stock = current_stock + (NEW.quantity * NEW.unit_multiplier),
    updated_at    = now()
  where id = NEW.item_id;
  return NEW;
end;
$$;

create trigger trg_update_item_stock
  after insert on transactions
  for each row
  execute function update_item_stock();

-- ============================================================
-- TRIGGER FUNCTION 2 — handle_new_user
-- Fires after every INSERT on auth.users.
-- Creates a corresponding user_profiles row automatically.
-- org_id starts null — set during onboarding step 2.
-- ============================================================
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer
as $$
begin
  insert into user_profiles (id, full_name)
  values (
    NEW.id,
    NEW.raw_user_meta_data ->> 'full_name'
  );
  return NEW;
end;
$$;

create trigger trg_handle_new_user
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- ============================================================
-- ENABLE ROW LEVEL SECURITY
-- Must be enabled before policies are created.
-- ============================================================
alter table organisations       enable row level security;
alter table user_profiles       enable row level security;
alter table user_settings       enable row level security;
alter table items               enable row level security;
alter table transactions        enable row level security;
alter table bills               enable row level security;
alter table recipes             enable row level security;
alter table recipe_ingredients  enable row level security;
alter table suppliers           enable row level security;
alter table agent_actions       enable row level security;
alter table unit_conversions    enable row level security;

-- ============================================================
-- RLS — organisations
-- Users may only see and modify their own organisation.
-- id is compared directly (this table IS the org).
-- ============================================================
create policy "org_select" on organisations
  for select
  using (
    id = (select org_id from user_profiles where id = auth.uid())
  );

create policy "org_write" on organisations
  for all
  using (
    id = (select org_id from user_profiles where id = auth.uid())
  );

-- ============================================================
-- RLS — user_profiles
-- Users may only see and modify their own profile row.
-- id = auth.uid() avoids the bootstrapping circular-dependency
-- that would occur if we looked up org_id from this same table.
-- ============================================================
create policy "org_select" on user_profiles
  for select
  using (id = auth.uid());

create policy "org_write" on user_profiles
  for all
  using (id = auth.uid());

-- ============================================================
-- RLS — user_settings
-- Standard org-scoped pattern using org_id.
-- ============================================================
create policy "org_select" on user_settings
  for select
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

create policy "org_write" on user_settings
  for all
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

-- ============================================================
-- RLS — items
-- ============================================================
create policy "org_select" on items
  for select
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

create policy "org_write" on items
  for all
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

-- ============================================================
-- RLS — transactions
-- ============================================================
create policy "org_select" on transactions
  for select
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

create policy "org_write" on transactions
  for all
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

-- ============================================================
-- RLS — bills
-- ============================================================
create policy "org_select" on bills
  for select
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

create policy "org_write" on bills
  for all
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

-- ============================================================
-- RLS — recipes
-- ============================================================
create policy "org_select" on recipes
  for select
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

create policy "org_write" on recipes
  for all
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

-- ============================================================
-- RLS — recipe_ingredients
-- ============================================================
create policy "org_select" on recipe_ingredients
  for select
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

create policy "org_write" on recipe_ingredients
  for all
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

-- ============================================================
-- RLS — suppliers
-- ============================================================
create policy "org_select" on suppliers
  for select
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

create policy "org_write" on suppliers
  for all
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

-- ============================================================
-- RLS — agent_actions
-- ============================================================
create policy "org_select" on agent_actions
  for select
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

create policy "org_write" on agent_actions
  for all
  using (
    org_id = (select org_id from user_profiles where id = auth.uid())
  );

-- ============================================================
-- RLS — unit_conversions
-- Global read-only reference table. No org_id.
-- Any authenticated user may read. No writes from application.
-- ============================================================
create policy "global_select" on unit_conversions
  for select
  using (true);
