-- ============================================================
-- 004_item_rpc.sql
-- Atomic item creation with optional initial stock transaction.
-- Rule D2: multi-table write → use RPC.
-- Rule D1: never write current_stock directly.
--          The trg_update_item_stock trigger handles it.
-- ============================================================

create or replace function create_item_with_initial_stock(
  p_org_id              uuid,
  p_name                text,
  p_category            text,
  p_unit                text,
  p_initial_stock       numeric,
  p_reorder_point       numeric,
  p_reorder_qty         numeric,
  p_cost_per_unit       numeric,
  p_track_expiry        boolean,
  p_preferred_supplier_id uuid,
  p_user_id             uuid
) returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_item_id uuid;
begin
  -- Insert the item (current_stock starts at 0; trigger will increment it)
  insert into items (
    org_id, name, category, unit, current_stock,
    reorder_point, reorder_qty, cost_per_unit,
    track_expiry, preferred_supplier_id
  ) values (
    p_org_id, p_name, p_category, p_unit, 0,
    p_reorder_point, p_reorder_qty, p_cost_per_unit,
    p_track_expiry, p_preferred_supplier_id
  ) returning id into v_item_id;

  -- Insert initial stock transaction if > 0
  -- The trigger trg_update_item_stock will set current_stock atomically
  if p_initial_stock > 0 then
    insert into transactions (
      org_id, item_id, type, quantity, unit,
      unit_multiplier, cost_per_unit, performed_by
    ) values (
      p_org_id, v_item_id, 'manual_addition', p_initial_stock, p_unit,
      1, p_cost_per_unit, p_user_id
    );
  end if;

  return v_item_id;
end;
$$;
