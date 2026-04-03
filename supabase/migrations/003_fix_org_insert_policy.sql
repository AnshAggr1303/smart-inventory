-- ============================================================
-- 003_fix_org_insert_policy.sql
-- Fix: split organisations "org_write" policy so that
-- authenticated users can INSERT a new organisation even
-- before their user_profiles.org_id is set (it starts null
-- and is updated in the next onboarding step).
--
-- The original "for all" policy used id = user_profiles.org_id
-- which always evaluates false on INSERT (org_id is null).
-- ============================================================

-- Drop all existing org policies before recreating
drop policy if exists "org_write" on organisations;
drop policy if exists "org_insert" on organisations;
drop policy if exists "org_select" on organisations;
drop policy if exists "org_update" on organisations;
drop policy if exists "org_delete" on organisations;

-- SELECT: only see your own org
create policy "org_select" on organisations
  for select
  using (
    id in (
      select org_id from user_profiles
      where id = auth.uid()
    )
  );

-- INSERT: any authenticated user may create a new org
-- (the user is creating their own org during onboarding,
--  before user_profiles.org_id has been set)
create policy "org_insert" on organisations
  for insert
  with check (auth.uid() is not null);

-- UPDATE: only your own org
create policy "org_update" on organisations
  for update
  using (
    id in (
      select org_id from user_profiles
      where id = auth.uid()
    )
  );

-- DELETE: blocked at application level
create policy "org_delete" on organisations
  for delete
  using (false);
