-- supabase/migrations/006_recipe_engine.sql
-- ─── Recipe Engine ────────────────────────────────────────────────────────────
-- 1. Add selling_price column to recipes
-- 2. create_recipe_with_ingredients — atomic recipe creation (recipes + recipe_ingredients)
-- 3. update_recipe_with_ingredients — atomic update (delete-and-reinsert ingredients)
-- 4. deduct_recipe — atomic stock deduction (inserts transactions; trigger handles current_stock)

-- ─── 1. selling_price column ──────────────────────────────────────────────────

alter table recipes
  add column if not exists selling_price numeric(12,2);

-- ─── 2. create_recipe_with_ingredients ───────────────────────────────────────

drop function if exists create_recipe_with_ingredients(
  uuid, text, text, numeric, text, text, numeric, jsonb
) cascade;

create or replace function create_recipe_with_ingredients(
  p_org_id        uuid,
  p_name          text,
  p_category      text,
  p_yield_qty     numeric,
  p_yield_unit    text,
  p_notes         text,
  p_selling_price numeric,
  p_ingredients   jsonb
  -- jsonb array of:
  -- { item_id: uuid, quantity: numeric, unit: text, unit_multiplier: numeric }
)
returns uuid   -- returns new recipe_id
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe_id uuid;
  v_ing       record;
begin
  insert into recipes (
    org_id, name, category, yield_qty, yield_unit, notes, selling_price
  ) values (
    p_org_id, p_name, p_category, p_yield_qty, p_yield_unit, p_notes, p_selling_price
  )
  returning id into v_recipe_id;

  for v_ing in
    select *
    from jsonb_to_recordset(p_ingredients) as x(
      item_id         uuid,
      quantity        numeric,
      unit            text,
      unit_multiplier numeric
    )
  loop
    insert into recipe_ingredients (
      org_id, recipe_id, item_id, quantity, unit, unit_multiplier
    ) values (
      p_org_id, v_recipe_id, v_ing.item_id,
      v_ing.quantity, v_ing.unit, v_ing.unit_multiplier
    );
  end loop;

  return v_recipe_id;
end;
$$;

grant execute on function create_recipe_with_ingredients(
  uuid, text, text, numeric, text, text, numeric, jsonb
) to authenticated;

-- ─── 3. update_recipe_with_ingredients ───────────────────────────────────────

drop function if exists update_recipe_with_ingredients(
  uuid, uuid, text, text, numeric, text, text, numeric, jsonb
) cascade;

create or replace function update_recipe_with_ingredients(
  p_org_id        uuid,
  p_recipe_id     uuid,
  p_name          text,
  p_category      text,
  p_yield_qty     numeric,
  p_yield_unit    text,
  p_notes         text,
  p_selling_price numeric,
  p_ingredients   jsonb
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ing       record;
  v_row_count int;
begin
  if not exists (
    select 1 from recipes
    where id = p_recipe_id and org_id = p_org_id
  ) then
    raise exception 'Recipe not found or access denied';
  end if;

  update recipes set
    name          = p_name,
    category      = p_category,
    yield_qty     = p_yield_qty,
    yield_unit    = p_yield_unit,
    notes         = p_notes,
    selling_price = p_selling_price,
    updated_at    = now()
  where id = p_recipe_id and org_id = p_org_id;

  get diagnostics v_row_count = row_count;
  if v_row_count = 0 then
    raise exception 'Recipe not found or was modified concurrently';
  end if;

  -- Delete and re-insert — never diff individual rows
  delete from recipe_ingredients
  where recipe_id = p_recipe_id and org_id = p_org_id;

  for v_ing in
    select *
    from jsonb_to_recordset(p_ingredients) as x(
      item_id         uuid,
      quantity        numeric,
      unit            text,
      unit_multiplier numeric
    )
  loop
    insert into recipe_ingredients (
      org_id, recipe_id, item_id, quantity, unit, unit_multiplier
    ) values (
      p_org_id, p_recipe_id, v_ing.item_id,
      v_ing.quantity, v_ing.unit, v_ing.unit_multiplier
    );
  end loop;
end;
$$;

grant execute on function update_recipe_with_ingredients(
  uuid, uuid, text, text, numeric, text, text, numeric, jsonb
) to authenticated;

-- ─── 4. deduct_recipe ─────────────────────────────────────────────────────────
-- Inserts one transaction per ingredient. The trigger on transactions
-- updates items.current_stock atomically — never touch current_stock directly.

drop function if exists deduct_recipe(
  uuid, uuid, uuid, numeric, text
) cascade;

create or replace function deduct_recipe(
  p_org_id    uuid,
  p_user_id   uuid,
  p_recipe_id uuid,
  p_quantity  numeric,
  p_note      text
) returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ingredient record;
begin
  if not exists (
    select 1 from recipes
    where id = p_recipe_id and org_id = p_org_id
  ) then
    raise exception 'Recipe not found or access denied';
  end if;

  for v_ingredient in
    select
      ri.item_id,
      ri.quantity,
      ri.unit,
      ri.unit_multiplier
    from recipe_ingredients ri
    where ri.recipe_id = p_recipe_id
      and ri.org_id    = p_org_id
  loop
    insert into transactions (
      org_id,
      item_id,
      type,
      quantity,
      unit,
      unit_multiplier,
      recipe_id,
      performed_by,
      note
    ) values (
      p_org_id,
      v_ingredient.item_id,
      'recipe_deduction',
      -(v_ingredient.quantity * p_quantity),
      v_ingredient.unit,
      v_ingredient.unit_multiplier,
      p_recipe_id,
      p_user_id,
      p_note
    );
  end loop;
end;
$$;

grant execute on function deduct_recipe(
  uuid, uuid, uuid, numeric, text
) to authenticated;
