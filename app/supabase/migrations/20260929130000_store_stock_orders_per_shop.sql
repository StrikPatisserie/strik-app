-- Bewaar de algemene winkelvoorraad per vestiging. De bestaande
-- letter_stock_targets blijven het productietotaal; deze regels vormen de
-- verdeelsleutel en mogen tot de ronde-deadline worden vervangen.
begin;

create table if not exists public.letter_store_stock_order_items (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.letter_production_batches(id) on delete restrict,
  location_code text not null check (location_code in ('ziekerstraat', 'heyendaal', 'daalseweg', 'lent')),
  product_id uuid not null references public.letter_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  confirmed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, location_code, product_id)
);

create index if not exists letter_store_stock_order_batch_idx
  on public.letter_store_stock_order_items (batch_id, location_code);

alter table public.letter_store_stock_order_items enable row level security;
revoke all on table public.letter_store_stock_order_items from public, anon, authenticated;
grant select, insert, update, delete on table public.letter_store_stock_order_items to service_role;

create or replace function public.letter_replace_store_stock_order(
  p_batch_id uuid,
  p_location_code text,
  p_lines jsonb,
  p_actor_id uuid
) returns void
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_batch public.letter_production_batches%rowtype;
  v_product_id uuid;
  v_old_quantity integer;
  v_new_quantity integer;
  v_current_target integer;
begin
  if p_location_code not in ('ziekerstraat', 'heyendaal', 'daalseweg', 'lent') then
    raise exception 'Kies een geldige winkel';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' then
    raise exception 'De winkelbestelling moet een lijst zijn';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(product_id uuid, quantity integer)
    where line.product_id is null or line.quantity is null or line.quantity <= 0
  ) then
    raise exception 'Alle bestelregels moeten een product en positief aantal hebben';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(product_id uuid, quantity integer)
    group by line.product_id
    having count(*) > 1
  ) then
    raise exception 'Een letteruitvoering mag maar één keer in de winkelbestelling staan';
  end if;

  select * into strict v_batch
  from public.letter_production_batches
  where id = p_batch_id
  for update;

  if v_batch.status not in ('OPEN', 'PLANNED') then
    raise exception 'Deze productieronde kan niet meer worden gewijzigd';
  end if;
  if now() > coalesce(
    v_batch.order_deadline_at,
    ((v_batch.production_date - 2) + time '20:00') at time zone 'Europe/Amsterdam'
  ) then
    raise exception 'De besteldeadline van deze productieronde is verstreken';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(product_id uuid, quantity integer)
    left join public.letter_products product on product.id = line.product_id
    where product.id is null or not product.active
  ) then
    raise exception 'Een letteruitvoering is niet beschikbaar';
  end if;

  -- Pas voor elk geraakt product alleen de bijdrage van deze winkel aan.
  -- Eventuele oudere, nog niet verdeelde voorraad blijft daardoor behouden.
  for v_product_id in
    select item.product_id
    from public.letter_store_stock_order_items item
    where item.batch_id = p_batch_id and item.location_code = p_location_code
    union
    select line.product_id
    from jsonb_to_recordset(p_lines) as line(product_id uuid, quantity integer)
  loop
    select coalesce(sum(item.quantity), 0)::integer into v_old_quantity
    from public.letter_store_stock_order_items item
    where item.batch_id = p_batch_id
      and item.location_code = p_location_code
      and item.product_id = v_product_id;

    select coalesce(sum(line.quantity), 0)::integer into v_new_quantity
    from jsonb_to_recordset(p_lines) as line(product_id uuid, quantity integer)
    where line.product_id = v_product_id;

    select coalesce(max(target.planned_quantity), 0) into v_current_target
    from public.letter_stock_targets target
    where target.batch_id = p_batch_id and target.product_id = v_product_id;

    perform public.letter_set_stock_target(
      p_batch_id,
      v_product_id,
      greatest(0, v_current_target - v_old_quantity + v_new_quantity),
      p_actor_id
    );
  end loop;

  delete from public.letter_store_stock_order_items
  where batch_id = p_batch_id and location_code = p_location_code;

  insert into public.letter_store_stock_order_items (
    batch_id,
    location_code,
    product_id,
    quantity,
    confirmed_by
  )
  select p_batch_id, p_location_code, line.product_id, line.quantity, p_actor_id
  from jsonb_to_recordset(p_lines) as line(product_id uuid, quantity integer);

  insert into public.letter_audit_events (entity_type, entity_id, action, details, actor_id)
  values (
    'production_batch',
    p_batch_id,
    'store_stock_order_replaced',
    jsonb_build_object('location_code', p_location_code, 'lines', p_lines),
    p_actor_id
  );
end;
$$;

revoke all on function public.letter_replace_store_stock_order(uuid, text, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.letter_replace_store_stock_order(uuid, text, jsonb, uuid)
  to service_role;

commit;
