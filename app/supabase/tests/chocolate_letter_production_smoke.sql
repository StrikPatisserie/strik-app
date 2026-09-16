-- Run only AFTER both chocolate-letter migrations. This test is transactional:
-- ROLLBACK removes all test products, orders, allocations and stock movements.
begin;

do $$
declare
  v_melk_s uuid;
  v_puur_a uuid;
  v_puur_s uuid;
  v_wit_s uuid;
  v_order uuid;
  v_melk_item uuid;
  v_puur_item uuid;
  v_batch_10 uuid;
  v_batch_24 uuid;
  v_request_key uuid := gen_random_uuid();
  v_registration_id uuid;
  v_online_key uuid := gen_random_uuid();
  v_online_order_id uuid;
  v_count integer;
begin
  insert into public.letter_products (code, letter, flavour, size, style)
    values ('SMOKE-MELK-S', 'S', 'melk', 'groot', 'spuit')
    on conflict (letter, flavour, size, style) do update set active = true
    returning id into v_melk_s;
  insert into public.letter_products (code, letter, flavour, size, style)
    values ('SMOKE-PUUR-A', 'A', 'puur', 'groot', 'spuit')
    on conflict (letter, flavour, size, style) do update set active = true
    returning id into v_puur_a;
  insert into public.letter_products (code, letter, flavour, size, style)
    values ('SMOKE-PUUR-S', 'S', 'puur', 'groot', 'spuit')
    on conflict (letter, flavour, size, style) do update set active = true
    returning id into v_puur_s;
  insert into public.letter_products (code, letter, flavour, size, style)
    values ('SMOKE-WIT-S', 'S', 'wit', 'groot', 'spuit')
    on conflict (letter, flavour, size, style) do update set active = true
    returning id into v_wit_s;

  insert into public.letter_production_batches (season, production_date)
    values (2099, '2099-11-10') returning id into v_batch_10;
  insert into public.letter_production_batches (season, production_date)
    values (2099, '2099-11-24') returning id into v_batch_24;
  insert into public.letter_orders
    (order_number, channel, customer_name, requested_date, fulfillment_method, delivery_address)
    values ('SMOKE-2099-BEDRIJF-X', 'B2B', 'Bedrijf X', '2099-11-28', 'DELIVERY', 'Testadres')
    returning id into v_order;
  insert into public.letter_order_items (order_id, product_id, quantity)
    values (v_order, v_melk_s, 200) returning id into v_melk_item;
  insert into public.letter_order_items (order_id, product_id, quantity)
    values (v_order, v_puur_a, 100) returning id into v_puur_item;

  perform public.letter_set_allocation(v_batch_10, v_melk_item, 150, null);
  perform public.letter_set_allocation(v_batch_24, v_melk_item, 50, null);
  perform public.letter_set_allocation(v_batch_10, v_puur_item, 50, null);
  perform public.letter_set_allocation(v_batch_24, v_puur_item, 50, null);
  begin
    perform public.letter_set_allocation(v_batch_24, v_melk_item, 60, null);
    raise exception 'Overplanning was accepted';
  exception when others then
    if sqlerrm = 'Overplanning was accepted' then raise; end if;
    if sqlerrm not like 'Overplanning:%' then raise; end if;
  end;
  perform public.letter_set_stock_target(v_batch_24, v_melk_s, 150, null);
  perform public.letter_set_stock_target(v_batch_24, v_puur_s, 80, null);
  perform public.letter_set_stock_target(v_batch_24, v_wit_s, 50, null);

  -- Of the first 100 made on 24 November, 50 belong to Bedrijf X and 50
  -- become free stock. Retrying the same request must not double the count.
  v_registration_id := public.letter_register_production(v_batch_24, v_melk_s, 100, v_request_key, null);
  if public.letter_register_production(v_batch_24, v_melk_s, 100, v_request_key, null) <> v_registration_id then
    raise exception 'Idempotent registration returned a different id';
  end if;
  select coalesce(sum(rp.quantity), 0) into v_count
    from public.letter_production_registration_parts rp
    join public.letter_production_allocations a on a.id = rp.allocation_id
    where a.order_item_id = v_melk_item and a.batch_id = v_batch_24;
  if v_count <> 50 then raise exception 'Expected 50 milk S for order, got %', v_count; end if;

  select coalesce(sum(quantity_delta), 0) into v_count
    from public.letter_inventory_movements where product_id = v_melk_s;
  if v_count <> 50 then raise exception 'Expected 50 free milk S, got %', v_count; end if;

  select count(*) into v_count from public.letter_production_registrations
    where request_key = v_request_key;
  if v_count <> 1 then raise exception 'Duplicate production registration'; end if;

  v_online_order_id := public.letter_create_order(
    p_request_key => v_online_key,
    p_channel => 'ONLINE',
    p_customer_name => 'Testklant',
    p_customer_email => 'test@example.invalid',
    p_phone => '0612345678',
    p_requested_date => '2099-11-28',
    p_pickup_location => 'lent',
    p_lines => jsonb_build_array(jsonb_build_object('product_id', v_melk_s, 'quantity', 2))
  );
  if public.letter_create_order(
    p_request_key => v_online_key,
    p_channel => 'ONLINE',
    p_customer_name => 'Testklant',
    p_customer_email => 'test@example.invalid',
    p_phone => '0612345678',
    p_requested_date => '2099-11-28',
    p_pickup_location => 'lent',
    p_lines => jsonb_build_array(jsonb_build_object('product_id', v_melk_s, 'quantity', 2))
  ) <> v_online_order_id then raise exception 'Duplicate online order was created'; end if;
  select count(*) into v_count from public.letter_mail_outbox
    where order_id = v_online_order_id and template = 'ONLINE_CONFIRMATION';
  if v_count <> 1 then raise exception 'Online confirmation was not queued exactly once'; end if;
end;
$$;

rollback;
