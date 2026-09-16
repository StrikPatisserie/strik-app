-- Chocolate letters use one transactional source of truth. Existing WordPress
-- orders are intentionally NOT changed by this migration.
create table public.letter_products (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  letter text not null check (letter ~ '^[A-Z]$'),
  flavour text not null check (flavour in ('melk', 'puur', 'wit', 'vegan-puur')),
  size text not null check (size in ('klein', 'groot')),
  style text not null check (style in ('spuit', 'vorm')),
  active boolean not null default true,
  unique (letter, flavour, size, style)
);

create table public.letter_orders (
  id uuid primary key default gen_random_uuid(),
  order_number text not null unique,
  channel text not null check (channel in ('ONLINE', 'STORE', 'B2B')),
  customer_name text not null check (length(trim(customer_name)) > 0),
  company_name text,
  contact_name text,
  customer_email text,
  phone text,
  customer_number text,
  purchase_order_number text,
  requested_date date not null,
  fulfillment_method text not null check (fulfillment_method in ('PICKUP', 'DELIVERY')),
  pickup_location text check (pickup_location in ('ziekerstraat', 'heyendaal', 'daalseweg', 'lent')),
  entered_store text check (entered_store in ('ziekerstraat', 'heyendaal', 'daalseweg', 'lent')),
  delivery_address text,
  notes text not null default '',
  fulfillment_status text not null default 'NEW' check (fulfillment_status in ('NEW', 'READY', 'COMPLETED', 'CANCELLED')),
  source_system text,
  source_id text,
  revision integer not null default 1 check (revision > 0),
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((channel = 'B2B') or (fulfillment_method = 'PICKUP')),
  check ((fulfillment_method <> 'PICKUP') or pickup_location is not null),
  unique (source_system, source_id)
);
create index letter_orders_search_idx on public.letter_orders (requested_date, channel, fulfillment_status);
create index letter_orders_customer_idx on public.letter_orders (lower(customer_name));

create table public.letter_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.letter_orders(id) on delete restrict,
  product_id uuid not null references public.letter_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  logo boolean not null default false,
  notes text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index letter_order_items_order_idx on public.letter_order_items (order_id);

create table public.letter_production_batches (
  id uuid primary key default gen_random_uuid(),
  season integer not null check (season between 2020 and 2100),
  production_date date not null,
  status text not null default 'OPEN' check (status in ('OPEN', 'PLANNED', 'IN_PRODUCTION', 'COMPLETED', 'CLOSED')),
  minimum_lead_days integer not null default 0 check (minimum_lead_days >= 0),
  closed_at timestamptz,
  closed_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season, production_date),
  check (extract(year from production_date) = season)
);

create table public.letter_production_allocations (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.letter_production_batches(id) on delete restrict,
  order_item_id uuid not null references public.letter_order_items(id) on delete restrict,
  planned_quantity integer not null check (planned_quantity > 0),
  order_revision_at_planning integer not null check (order_revision_at_planning > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, order_item_id)
);
create index letter_allocations_item_idx on public.letter_production_allocations (order_item_id);

create table public.letter_stock_targets (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.letter_production_batches(id) on delete restrict,
  product_id uuid not null references public.letter_products(id) on delete restrict,
  planned_quantity integer not null check (planned_quantity >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (batch_id, product_id)
);

create table public.letter_production_registrations (
  id uuid primary key default gen_random_uuid(),
  request_key uuid not null unique,
  batch_id uuid not null references public.letter_production_batches(id) on delete restrict,
  product_id uuid not null references public.letter_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  registered_by uuid references public.profiles(id) on delete set null,
  registered_at timestamptz not null default now(),
  note text not null default ''
);

create table public.letter_production_registration_parts (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.letter_production_registrations(id) on delete restrict,
  allocation_id uuid references public.letter_production_allocations(id) on delete restrict,
  stock_target_id uuid references public.letter_stock_targets(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  check (num_nonnulls(allocation_id, stock_target_id) = 1)
);
create index letter_parts_allocation_idx on public.letter_production_registration_parts (allocation_id);
create index letter_parts_stock_idx on public.letter_production_registration_parts (stock_target_id);

create table public.letter_inventory_movements (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.letter_products(id) on delete restrict,
  location_code text not null default 'central',
  quantity_delta integer not null check (quantity_delta <> 0),
  reason text not null check (reason in ('PRODUCED_FOR_STOCK', 'RELEASED_FROM_ORDER', 'TRANSFER', 'SALE', 'CORRECTION')),
  registration_part_id uuid unique references public.letter_production_registration_parts(id) on delete restrict,
  order_item_id uuid references public.letter_order_items(id) on delete restrict,
  note text not null default '',
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index letter_stock_balance_idx on public.letter_inventory_movements (product_id, location_code);

create table public.letter_audit_events (
  id bigint generated always as identity primary key,
  entity_type text not null,
  entity_id uuid not null,
  action text not null,
  details jsonb not null default '{}'::jsonb,
  reason text,
  actor_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);
create index letter_audit_entity_idx on public.letter_audit_events (entity_type, entity_id, created_at);

create view public.letter_stock_balances with (security_invoker = true) as
  select product_id, location_code, sum(quantity_delta)::integer as available_quantity
  from public.letter_inventory_movements
  group by product_id, location_code;

-- No browser may write production tables directly. The server validates the
-- profile, then calls the restricted functions below with the service role.
alter table public.letter_products enable row level security;
alter table public.letter_orders enable row level security;
alter table public.letter_order_items enable row level security;
alter table public.letter_production_batches enable row level security;
alter table public.letter_production_allocations enable row level security;
alter table public.letter_stock_targets enable row level security;
alter table public.letter_production_registrations enable row level security;
alter table public.letter_production_registration_parts enable row level security;
alter table public.letter_inventory_movements enable row level security;
alter table public.letter_audit_events enable row level security;

create or replace function public.letter_set_allocation(
  p_batch_id uuid, p_order_item_id uuid, p_quantity integer, p_actor_id uuid
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_item public.letter_order_items%rowtype;
  v_order public.letter_orders%rowtype;
  v_batch public.letter_production_batches%rowtype;
  v_existing public.letter_production_allocations%rowtype;
  v_planned integer;
  v_produced integer;
  v_id uuid;
begin
  if p_quantity < 0 then raise exception 'Aantal mag niet negatief zijn'; end if;
  -- Lock order item first. Concurrent allocation requests for this item serialize.
  select * into strict v_item from public.letter_order_items where id = p_order_item_id for update;
  select * into strict v_order from public.letter_orders where id = v_item.order_id for update;
  select * into strict v_batch from public.letter_production_batches where id = p_batch_id for update;
  if v_order.fulfillment_status = 'CANCELLED' then raise exception 'Geannuleerde order kan niet gepland worden'; end if;
  if v_batch.status in ('COMPLETED', 'CLOSED') then raise exception 'Productiedag is gereed of afgesloten'; end if;
  select * into v_existing from public.letter_production_allocations
    where batch_id = p_batch_id and order_item_id = p_order_item_id for update;
  select coalesce(sum(quantity), 0) into v_produced
    from public.letter_production_registration_parts where allocation_id = v_existing.id;
  if p_quantity < v_produced then raise exception 'Planning kan niet lager zijn dan reeds geproduceerd (%)', v_produced; end if;
  select coalesce(sum(planned_quantity), 0) into v_planned
    from public.letter_production_allocations where order_item_id = p_order_item_id and id is distinct from v_existing.id;
  if v_planned + p_quantity > v_item.quantity then
    raise exception 'Overplanning: besteld %, elders gepland %, aangevraagd %', v_item.quantity, v_planned, p_quantity;
  end if;
  if p_quantity = 0 then
    if v_existing.id is not null then delete from public.letter_production_allocations where id = v_existing.id; end if;
    v_id := null;
  else
    insert into public.letter_production_allocations (batch_id, order_item_id, planned_quantity, order_revision_at_planning)
    values (p_batch_id, p_order_item_id, p_quantity, v_order.revision)
    on conflict (batch_id, order_item_id) do update
      set planned_quantity = excluded.planned_quantity, updated_at = now()
    returning id into v_id;
  end if;
  insert into public.letter_audit_events (entity_type, entity_id, action, details, actor_id)
    values ('order_item', p_order_item_id, 'allocation_set', jsonb_build_object('batch_id', p_batch_id, 'quantity', p_quantity), p_actor_id);
  return v_id;
end;
$$;

create or replace function public.letter_register_production(
  p_batch_id uuid, p_product_id uuid, p_quantity integer, p_request_key uuid, p_actor_id uuid
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_batch public.letter_production_batches%rowtype;
  v_registration_id uuid;
  v_remaining integer := p_quantity;
  v_open integer;
  v_take integer;
  v_allocation record;
  v_stock record;
  v_part_id uuid;
  v_existing_registration public.letter_production_registrations%rowtype;
begin
  if p_quantity <= 0 then raise exception 'Productieaantal moet positief zijn'; end if;
  -- This lock also serializes registrations for the same production day.
  select * into strict v_batch from public.letter_production_batches where id = p_batch_id for update;
  select * into v_existing_registration from public.letter_production_registrations where request_key = p_request_key;
  if v_existing_registration.id is not null then
    if v_existing_registration.batch_id <> p_batch_id
      or v_existing_registration.product_id <> p_product_id
      or v_existing_registration.quantity <> p_quantity then
      raise exception 'Verzoek-ID is al gebruikt voor een andere productieboeking';
    end if;
    return v_existing_registration.id;
  end if;
  if v_batch.status not in ('OPEN', 'PLANNED', 'IN_PRODUCTION') then
    raise exception 'Op deze productiedag kan niet geproduceerd worden';
  end if;
  insert into public.letter_production_registrations (request_key, batch_id, product_id, quantity, registered_by)
    values (p_request_key, p_batch_id, p_product_id, p_quantity, p_actor_id)
    returning id into v_registration_id;
  for v_allocation in
    select a.id, a.planned_quantity, o.requested_date, o.order_number,
      coalesce(sum(rp.quantity), 0)::integer as produced
    from public.letter_production_allocations a
    join public.letter_order_items i on i.id = a.order_item_id
    join public.letter_orders o on o.id = i.order_id
    left join public.letter_production_registration_parts rp on rp.allocation_id = a.id
    where a.batch_id = p_batch_id and i.product_id = p_product_id and o.fulfillment_status <> 'CANCELLED'
    group by a.id, o.requested_date, o.order_number
    order by o.requested_date, o.order_number, a.id
  loop
    exit when v_remaining = 0;
    v_open := v_allocation.planned_quantity - v_allocation.produced;
    v_take := least(v_remaining, greatest(v_open, 0));
    if v_take > 0 then
      insert into public.letter_production_registration_parts (registration_id, allocation_id, quantity)
        values (v_registration_id, v_allocation.id, v_take);
      v_remaining := v_remaining - v_take;
    end if;
  end loop;
  if v_remaining > 0 then
    select s.id, s.planned_quantity, coalesce(sum(rp.quantity), 0)::integer as produced
      into v_stock
      from public.letter_stock_targets s
      left join public.letter_production_registration_parts rp on rp.stock_target_id = s.id
      where s.batch_id = p_batch_id and s.product_id = p_product_id
      group by s.id;
    if v_stock.id is not null then
      v_take := least(v_remaining, greatest(v_stock.planned_quantity - v_stock.produced, 0));
      if v_take > 0 then
        insert into public.letter_production_registration_parts (registration_id, stock_target_id, quantity)
          values (v_registration_id, v_stock.id, v_take) returning id into v_part_id;
        insert into public.letter_inventory_movements
          (product_id, quantity_delta, reason, registration_part_id, created_by)
          values (p_product_id, v_take, 'PRODUCED_FOR_STOCK', v_part_id, p_actor_id);
        v_remaining := v_remaining - v_take;
      end if;
    end if;
  end if;
  if v_remaining > 0 then
    raise exception 'Meer geproduceerd dan gepland: % stuks passen niet in orders of extra voorraad', v_remaining;
  end if;
  update public.letter_production_batches set status = 'IN_PRODUCTION', updated_at = now() where id = p_batch_id;
  insert into public.letter_audit_events (entity_type, entity_id, action, details, actor_id)
    values ('production_batch', p_batch_id, 'production_registered',
      jsonb_build_object('registration_id', v_registration_id, 'product_id', p_product_id, 'quantity', p_quantity), p_actor_id);
  return v_registration_id;
end;
$$;

create or replace function public.letter_set_stock_target(
  p_batch_id uuid, p_product_id uuid, p_quantity integer, p_actor_id uuid
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_batch public.letter_production_batches%rowtype;
  v_target public.letter_stock_targets%rowtype;
  v_produced integer;
  v_id uuid;
begin
  if p_quantity < 0 then raise exception 'Voorraaddoel mag niet negatief zijn'; end if;
  select * into strict v_batch from public.letter_production_batches where id = p_batch_id for update;
  if v_batch.status in ('COMPLETED', 'CLOSED') then raise exception 'Productiedag is gereed of afgesloten'; end if;
  select * into v_target from public.letter_stock_targets
    where batch_id = p_batch_id and product_id = p_product_id for update;
  select coalesce(sum(quantity), 0) into v_produced
    from public.letter_production_registration_parts where stock_target_id = v_target.id;
  if p_quantity < v_produced then raise exception 'Voorraaddoel kan niet lager zijn dan reeds geproduceerd (%)', v_produced; end if;
  if p_quantity = 0 then
    if v_target.id is not null then delete from public.letter_stock_targets where id = v_target.id; end if;
    v_id := null;
  else
    insert into public.letter_stock_targets (batch_id, product_id, planned_quantity)
      values (p_batch_id, p_product_id, p_quantity)
      on conflict (batch_id, product_id) do update
        set planned_quantity = excluded.planned_quantity, updated_at = now()
      returning id into v_id;
  end if;
  insert into public.letter_audit_events (entity_type, entity_id, action, details, actor_id)
    values ('production_batch', p_batch_id, 'stock_target_set',
      jsonb_build_object('product_id', p_product_id, 'quantity', p_quantity), p_actor_id);
  return v_id;
end;
$$;

create or replace function public.letter_suggest_batch(p_requested_date date)
returns uuid language sql stable security invoker set search_path = public as $$
  select id from public.letter_production_batches
  where season = extract(year from p_requested_date)::integer
    and status in ('OPEN', 'PLANNED')
    and production_date + minimum_lead_days <= p_requested_date
  order by production_date desc
  limit 1;
$$;

revoke all on function public.letter_set_allocation(uuid, uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.letter_register_production(uuid, uuid, integer, uuid, uuid) from public, anon, authenticated;
revoke all on function public.letter_set_stock_target(uuid, uuid, integer, uuid) from public, anon, authenticated;
revoke all on function public.letter_suggest_batch(date) from public, anon, authenticated;
grant execute on function public.letter_set_allocation(uuid, uuid, integer, uuid) to service_role;
grant execute on function public.letter_register_production(uuid, uuid, integer, uuid, uuid) to service_role;
grant execute on function public.letter_set_stock_target(uuid, uuid, integer, uuid) to service_role;
grant execute on function public.letter_suggest_batch(date) to service_role;
