-- Preserve the rate agreed on existing orders; new orders use EUR 0.25.
alter table public.letter_orders
  add column if not exists gift_wrap_price_cents integer not null default 100;
alter table public.letter_orders alter column gift_wrap_price_cents set default 25;

create or replace function public.letter_create_online_checkout(
  p_request_key uuid,
  p_customer_name text,
  p_customer_email text,
  p_phone text,
  p_requested_date date,
  p_pickup_location text,
  p_lines jsonb,
  p_notes text,
  p_gift_wrap boolean
) returns uuid language plpgsql security invoker set search_path = public as $$
declare
  v_order_id uuid;
  v_quantity integer;
  v_wrap_cents integer;
begin
  if p_request_key is null then raise exception 'Verzoek-ID ontbreekt'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_request_key::text, 0));
  select id into v_order_id from public.letter_orders where request_key = p_request_key;
  -- A retry must preserve the original order and immutable mail prices.
  if found then return v_order_id; end if;

  v_order_id := public.letter_create_online_checkout(
    p_request_key, p_customer_name, p_customer_email, p_phone,
    p_requested_date, p_pickup_location, p_lines, p_notes
  );
  select coalesce(sum(quantity), 0)::integer into v_quantity
  from public.letter_order_items where order_id = v_order_id;
  v_wrap_cents := case when coalesce(p_gift_wrap, false) then v_quantity * 25 else 0 end;

  update public.letter_orders
  set gift_wrap = coalesce(p_gift_wrap, false), gift_wrap_price_cents = 25
  where id = v_order_id;

  update public.letter_mail_outbox
  set payload = payload || jsonb_build_object(
    'gift_wrap', coalesce(p_gift_wrap, false),
    'gift_wrap_price_cents', 25,
    'gift_wrap_total_cents', v_wrap_cents,
    'total_cents', coalesce((payload ->> 'total_cents')::integer, 0) + v_wrap_cents
  )
  where order_id = v_order_id and status = 'PENDING';
  return v_order_id;
end;
$$;

revoke all on function public.letter_create_online_checkout(uuid, text, text, text, date, text, jsonb, text, boolean)
  from public, anon, authenticated;
grant execute on function public.letter_create_online_checkout(uuid, text, text, text, date, text, jsonb, text, boolean)
  to service_role;
