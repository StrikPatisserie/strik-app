-- Run after migration 20260916030000. All test data is rolled back.
begin;
do $$
declare
  v_key uuid := gen_random_uuid();
  v_product uuid;
  v_order uuid;
  v_count integer;
  v_path text;
begin
  select id into strict v_product from public.letter_products
    where code = 'SPUIT-MELK-GROOT-S' and active = true;
  insert into public.letter_production_batches (season, production_date)
    values (2098, '2098-11-10');
  v_path := v_key::text || '/0.jpg';
  v_order := public.letter_create_online_checkout(
    p_request_key => v_key,
    p_customer_name => 'Testklant',
    p_customer_email => 'test@example.invalid',
    p_phone => '0612345678',
    p_requested_date => '2098-11-28',
    p_pickup_location => 'lent',
    p_lines => jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'quantity', 2,
      'logo', true, 'logo_path', v_path
    ))
  );
  if public.letter_create_online_checkout(
    p_request_key => v_key,
    p_customer_name => 'Testklant',
    p_customer_email => 'test@example.invalid',
    p_phone => '0612345678',
    p_requested_date => '2098-11-28',
    p_pickup_location => 'lent',
    p_lines => jsonb_build_array(jsonb_build_object(
      'product_id', v_product, 'quantity', 2,
      'logo', true, 'logo_path', v_path
    ))
  ) <> v_order then raise exception 'Dubbele order bij herhaalverzoek'; end if;
  select count(*) into v_count from public.letter_order_items
    where order_id = v_order and quantity = 2 and logo_storage_path = v_path
      and notes = '' and unit_price_cents = 1395 and logo_price_cents = 50;
  if v_count <> 1 then raise exception 'Prijs of foto ontbreekt bij orderregel'; end if;
  select count(*) into v_count from public.letter_mail_outbox
    where order_id = v_order and payload ->> 'total_cents' = '2890'
      and payload -> 'items' -> 0 ->> 'logo_storage_path' = v_path;
  if v_count <> 2 then raise exception 'Mailkopieën bevatten niet het juiste totaal of fotopad'; end if;
end;
$$;
rollback;
