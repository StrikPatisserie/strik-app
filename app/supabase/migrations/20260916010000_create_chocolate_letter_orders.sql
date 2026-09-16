-- Requires 20260916000000_create_chocolate_letter_production.sql.
-- Order creation and confirmation mail scheduling are one transaction.
create table public.letter_order_sequences (
  season integer primary key check (season between 2020 and 2100),
  next_number integer not null check (next_number > 0)
);

alter table public.letter_orders add column request_key uuid unique;

create table public.letter_mail_outbox (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.letter_orders(id) on delete restrict,
  template text not null check (template in ('ONLINE_CONFIRMATION', 'INTERNAL_ORDER_BACKUP', 'ORDER_CHANGE', 'ORDER_CANCELLATION')),
  -- Immutable order details: a later edit must not silently change the original mail.
  payload jsonb not null,
  status text not null default 'PENDING' check (status in ('PENDING', 'SENDING', 'SENT', 'FAILED')),
  attempts integer not null default 0 check (attempts >= 0),
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz,
  unique (order_id, template)
);
create index letter_mail_outbox_pending_idx on public.letter_mail_outbox (created_at)
  where status in ('PENDING', 'FAILED');
alter table public.letter_order_sequences enable row level security;
alter table public.letter_mail_outbox enable row level security;

create or replace function public.letter_create_order(
  p_request_key uuid,
  p_channel text,
  p_customer_name text,
  p_customer_email text,
  p_phone text,
  p_requested_date date,
  p_pickup_location text,
  p_lines jsonb,
  p_actor_id uuid default null,
  p_company_name text default null,
  p_contact_name text default null,
  p_entered_store text default null,
  p_fulfillment_method text default 'PICKUP',
  p_delivery_address text default null,
  p_notes text default '',
  p_source_system text default null,
  p_source_id text default null
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_order_id uuid;
  v_season integer;
  v_next_number integer;
  v_batch_id uuid;
  v_product public.letter_products%rowtype;
  v_line jsonb;
  v_item_id uuid;
  v_quantity integer;
  v_mail_payload jsonb;
begin
  if p_request_key is null then raise exception 'Verzoek-ID ontbreekt'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  select id into v_order_id from public.letter_orders where request_key = p_request_key;
  if v_order_id is not null then return v_order_id; end if;

  if p_channel not in ('ONLINE', 'STORE', 'B2B') then raise exception 'Ongeldig orderkanaal'; end if;
  if length(trim(coalesce(p_customer_name, ''))) < 2 then raise exception 'Klantnaam ontbreekt'; end if;
  if p_requested_date is null then raise exception 'Afhaal- of leverdatum ontbreekt'; end if;
  if p_channel = 'ONLINE' and (p_customer_email is null or position('@' in p_customer_email) < 2) then
    raise exception 'E-mailadres ontbreekt';
  end if;
  if p_channel <> 'B2B' and p_fulfillment_method <> 'PICKUP' then
    raise exception 'Winkel- en onlinebestellingen zijn alleen af te halen';
  end if;
  if p_fulfillment_method = 'PICKUP' and p_pickup_location not in
    ('ziekerstraat', 'heyendaal', 'daalseweg', 'lent') then
    raise exception 'Kies een van de vier afhaallocaties';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) is distinct from 'array'
    or jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 100 then
    raise exception 'Bestelling moet 1 tot 100 regels bevatten';
  end if;

  v_season := extract(year from p_requested_date)::integer;
  insert into public.letter_order_sequences (season, next_number)
    values (v_season, 2)
    on conflict (season) do update set next_number = public.letter_order_sequences.next_number + 1
    returning next_number - 1 into v_next_number;

  insert into public.letter_orders
    (order_number, channel, customer_name, company_name, contact_name,
     customer_email, phone, requested_date, fulfillment_method, pickup_location,
     entered_store, delivery_address, notes, source_system, source_id,
     request_key, created_by, updated_by)
    values
    ('CL' || right(v_season::text, 2) || '-' || lpad(v_next_number::text, 4, '0'),
     p_channel, trim(p_customer_name), nullif(trim(coalesce(p_company_name, '')), ''),
     nullif(trim(coalesce(p_contact_name, '')), ''), nullif(trim(coalesce(p_customer_email, '')), ''),
     nullif(trim(coalesce(p_phone, '')), ''), p_requested_date, p_fulfillment_method,
     p_pickup_location, p_entered_store, p_delivery_address, coalesce(p_notes, ''),
     p_source_system, p_source_id, p_request_key, p_actor_id, p_actor_id)
    returning id into v_order_id;

  select public.letter_suggest_batch(p_requested_date) into v_batch_id;
  for v_line in select value from jsonb_array_elements(p_lines) loop
    if coalesce(v_line ->> 'quantity', '') !~ '^[1-9][0-9]*$' then
      raise exception 'Ongeldig aantal in orderregel';
    end if;
    v_quantity := (v_line ->> 'quantity')::integer;
    if v_quantity > 100000 then raise exception 'Aantal per orderregel is te groot'; end if;
    select * into v_product from public.letter_products
      where id = (v_line ->> 'product_id')::uuid and active = true;
    if v_product.id is null then raise exception 'Onbekend of inactief letterproduct'; end if;
    insert into public.letter_order_items (order_id, product_id, quantity, logo, notes)
      values (v_order_id, v_product.id, v_quantity,
        coalesce((v_line ->> 'logo')::boolean, false), left(coalesce(v_line ->> 'notes', ''), 1000))
      returning id into v_item_id;
    if v_batch_id is not null then
      perform public.letter_set_allocation(v_batch_id, v_item_id, v_quantity, p_actor_id);
    end if;
  end loop;

  select jsonb_build_object(
    'order_number', o.order_number,
    'created_at', o.created_at,
    'channel', o.channel,
    'customer_name', o.customer_name,
    'company_name', o.company_name,
    'contact_name', o.contact_name,
    'customer_email', o.customer_email,
    'phone', o.phone,
    'requested_date', o.requested_date,
    'fulfillment_method', o.fulfillment_method,
    'pickup_location', o.pickup_location,
    'entered_store', o.entered_store,
    'delivery_address', o.delivery_address,
    'notes', o.notes,
    'source_system', o.source_system,
    'source_id', o.source_id,
    'payment_method', case when o.channel = 'ONLINE' then 'PAY_ON_PICKUP' else null end,
    'items', (
      select jsonb_agg(jsonb_build_object(
        'letter', p.letter, 'flavour', p.flavour, 'size', p.size,
        'style', p.style, 'product_code', p.code, 'quantity', i.quantity,
        'logo', i.logo, 'notes', i.notes
      ) order by i.created_at, i.id)
      from public.letter_order_items i
      join public.letter_products p on p.id = i.product_id
      where i.order_id = o.id
    )
  ) into v_mail_payload
  from public.letter_orders o where o.id = v_order_id;

  insert into public.letter_mail_outbox (order_id, template, payload)
    values (v_order_id, 'INTERNAL_ORDER_BACKUP', v_mail_payload);
  if p_channel = 'ONLINE' then
    insert into public.letter_mail_outbox (order_id, template, payload)
      values (v_order_id, 'ONLINE_CONFIRMATION', v_mail_payload);
  end if;
  insert into public.letter_audit_events (entity_type, entity_id, action, details, actor_id)
    values ('order', v_order_id, 'created',
      jsonb_build_object('channel', p_channel, 'suggested_batch_id', v_batch_id), p_actor_id);
  return v_order_id;
end;
$$;

revoke all on function public.letter_create_order(uuid, text, text, text, text, date, text, jsonb, uuid, text, text, text, text, text, text, text, text) from public, anon, authenticated;
grant execute on function public.letter_create_order(uuid, text, text, text, text, date, text, jsonb, uuid, text, text, text, text, text, text, text, text) to service_role;
