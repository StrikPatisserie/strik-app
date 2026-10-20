-- No emails are sent and every test row is rolled back.
begin;
do $$
declare
  v_key uuid := gen_random_uuid();
  v_product uuid;
  v_order uuid;
  v_plain_order uuid;
  v_count integer;
  v_payloads jsonb;
begin
  select id into strict v_product from public.letter_products
    where code = 'SPUIT-MELK-GROOT-S' and active = true;
  insert into public.letter_production_batches (season, production_date)
    values (2098, '2098-11-10');
  v_order := public.letter_create_online_checkout(
    v_key, 'Test inpakken', 'test@example.invalid', '0612345678',
    '2098-11-28', 'lent',
    jsonb_build_array(jsonb_build_object('product_id', v_product, 'quantity', 2, 'logo', false)),
    '', true
  );
  if not exists (select 1 from public.letter_orders where id = v_order and gift_wrap and gift_wrap_price_cents = 25)
    then raise exception 'Verkeerde opgeslagen inpakprijs'; end if;
  select count(*) into v_count from public.letter_mail_outbox
    where order_id = v_order and payload ->> 'gift_wrap_price_cents' = '25'
      and payload ->> 'gift_wrap_total_cents' = '50' and payload ->> 'total_cents' = '2840';
  if v_count <> 2 then raise exception 'Mailtotaal moet 2 x (1395 + 25) = 2840 cent zijn'; end if;
  select jsonb_agg(payload order by id) into v_payloads from public.letter_mail_outbox where order_id = v_order;
  if public.letter_create_online_checkout(
    v_key, 'Test inpakken', 'test@example.invalid', '0612345678', '2098-11-28', 'lent',
    jsonb_build_array(jsonb_build_object('product_id', v_product, 'quantity', 2, 'logo', false)), '', true
  ) <> v_order then raise exception 'Dubbele order bij opnieuw indienen'; end if;
  if v_payloads is distinct from (select jsonb_agg(payload order by id) from public.letter_mail_outbox where order_id = v_order)
    then raise exception 'Herhaalverzoek heeft mailprijzen gewijzigd'; end if;
  v_plain_order := public.letter_create_online_checkout(
    gen_random_uuid(), 'Test zonder inpakken', 'test@example.invalid', '0612345678',
    '2098-11-28', 'lent',
    jsonb_build_array(jsonb_build_object('product_id', v_product, 'quantity', 2, 'logo', false)), '', false
  );
  select count(*) into v_count from public.letter_mail_outbox where order_id = v_plain_order
    and payload ->> 'gift_wrap_total_cents' = '0' and payload ->> 'total_cents' = '2790';
  if v_count <> 2 then raise exception 'Zonder inpakken mag geen toeslag worden gerekend'; end if;
end;
$$;
rollback;
