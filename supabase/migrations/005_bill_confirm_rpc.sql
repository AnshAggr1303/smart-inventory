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
