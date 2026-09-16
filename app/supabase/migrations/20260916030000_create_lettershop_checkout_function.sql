-- Public checkout is called only by a server route with the service-role key.
-- The order, photo associations and immutable mail snapshots commit together.
alter table public.letter_mail_outbox add column last_attempt_at timestamptz;

create table public.lettershop_rate_limits (
  client_hash text not null,
  window_start timestamptz not null,
  request_count integer not null check (request_count > 0),
  primary key (client_hash, window_start)
);
alter table public.lettershop_rate_limits enable row level security;

create or replace function public.lettershop_consume_rate_limit(p_client_hash text)
returns boolean language plpgsql security invoker set search_path = public as $$
declare v_count integer;
begin
  if length(p_client_hash) <> 64 then raise exception 'Ongeldige limietsleutel'; end if;
  insert into public.lettershop_rate_limits (client_hash, window_start, request_count)
    values (p_client_hash, date_trunc('hour', now()), 1)
    on conflict (client_hash, window_start) do update
      set request_count = public.lettershop_rate_limits.request_count + 1
    returning request_count into v_count;
  return v_count <= 5;
end;
$$;
revoke all on function public.lettershop_consume_rate_limit(text) from public, anon, authenticated;
grant execute on function public.lettershop_consume_rate_limit(text) to service_role;

create or replace function public.letter_create_online_checkout(
  p_request_key uuid,
  p_customer_name text,
  p_customer_email text,
  p_phone text,
  p_requested_date date,
  p_pickup_location text,
  p_lines jsonb,
  p_notes text default ''
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_order_id uuid;
  v_lines jsonb := '[]'::jsonb;
  v_line jsonb;
  v_path text;
  v_items jsonb;
  v_total_cents integer;
begin
  if p_lines is null or jsonb_typeof(p_lines) is distinct from 'array'
    or jsonb_array_length(p_lines) < 1 or jsonb_array_length(p_lines) > 30 then
    raise exception 'Bestelling moet 1 tot 30 regels bevatten';
  end if;
  if p_requested_date < current_date then raise exception 'Afhaaldatum ligt in het verleden'; end if;

  for v_line in select value from jsonb_array_elements(p_lines) loop
    v_path := nullif(v_line ->> 'logo_path', '');
    if coalesce((v_line ->> 'logo')::boolean, false) and
       (v_path is null or v_path !~ ('^' || p_request_key::text || '/[0-9]+\.(jpg|jpeg|png|webp|heic|heif)$')) then
      raise exception 'Foto/logo ontbreekt of heeft een ongeldig pad';
    end if;
    if not coalesce((v_line ->> 'logo')::boolean, false) and v_path is not null then
      raise exception 'Afbeelding zonder foto/logo-keuze';
    end if;
    v_lines := v_lines || jsonb_build_array(jsonb_build_object(
      'product_id', v_line ->> 'product_id',
      'quantity', v_line ->> 'quantity',
      'logo', coalesce((v_line ->> 'logo')::boolean, false),
      'notes', case when v_path is not null then '__lettershop_photo__:' || v_path else '' end
    ));
  end loop;

  v_order_id := public.letter_create_order(
    p_request_key => p_request_key,
    p_channel => 'ONLINE',
    p_customer_name => p_customer_name,
    p_customer_email => p_customer_email,
    p_phone => p_phone,
    p_requested_date => p_requested_date,
    p_pickup_location => p_pickup_location,
    p_lines => v_lines,
    p_notes => left(coalesce(p_notes, ''), 1800)
  );

  update public.letter_order_items
  set logo_storage_path = substring(notes from 22), notes = ''
  where order_id = v_order_id and notes like '__lettershop_photo__:%'
    and logo_storage_path is null;

  select jsonb_agg(jsonb_build_object(
      'letter', p.letter, 'flavour', p.flavour, 'size', p.size,
      'style', p.style, 'product_code', p.code, 'quantity', i.quantity,
      'unit_price_cents', i.unit_price_cents,
      'logo_price_cents', i.logo_price_cents,
      'logo', i.logo, 'logo_storage_path', i.logo_storage_path,
      'notes', i.notes
    ) order by i.created_at, i.id),
    sum(i.quantity * (coalesce(i.unit_price_cents, 0) + i.logo_price_cents))
  into v_items, v_total_cents
  from public.letter_order_items i
  join public.letter_products p on p.id = i.product_id
  where i.order_id = v_order_id;

  update public.letter_mail_outbox
  set payload = payload || jsonb_build_object(
    'items', v_items, 'total_cents', v_total_cents,
    'payment_method', 'PAY_ON_PICKUP'
  )
  where order_id = v_order_id and status = 'PENDING';

  return v_order_id;
end;
$$;

revoke all on function public.letter_create_online_checkout(uuid, text, text, text, date, text, jsonb, text)
  from public, anon, authenticated;
grant execute on function public.letter_create_online_checkout(uuid, text, text, text, date, text, jsonb, text)
  to service_role;
