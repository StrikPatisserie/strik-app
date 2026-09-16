-- Transactional test: no order, email or production change survives ROLLBACK.
begin;
do $$
declare
  v_request_key uuid := gen_random_uuid();
  v_product_id uuid;
  v_order_id uuid;
  v_order_number text;
  v_job_id uuid;
  v_count integer;
  v_wrong_confirmation_blocked boolean := false;
begin
  select id into v_product_id from public.letter_products
  where code = 'SPUIT-MELK-GROOT-F' and active = true;
  if v_product_id is null then raise exception 'Testproduct ontbreekt'; end if;
  v_order_id := public.letter_create_online_checkout(
    v_request_key, 'Test klant', 'test@example.com', '0612345678',
    date '2026-11-12', 'heyendaal',
    jsonb_build_array(jsonb_build_object(
      'product_id', v_product_id, 'quantity', 1, 'logo', true,
      'logo_path', v_request_key::text || '/0.jpg'
    )), 'TESTBESTELLING'
  );
  select order_number into v_order_number from public.letter_orders where id = v_order_id;
  begin
    perform public.lettershop_delete_unproduced_order(v_order_id, 'CL26-ONJUIST');
  exception when others then
    v_wrong_confirmation_blocked := true;
  end;
  if not v_wrong_confirmation_blocked then raise exception 'Verkeerde bevestiging werd geaccepteerd'; end if;
  v_job_id := public.lettershop_delete_unproduced_order(v_order_id, v_order_number);
  select count(*) into v_count from public.letter_orders where id = v_order_id;
  if v_count <> 0 then raise exception 'Order bleef bestaan'; end if;
  select count(*) into v_count from public.letter_order_items where order_id = v_order_id;
  if v_count <> 0 then raise exception 'Orderregels bleven bestaan'; end if;
  select count(*) into v_count from public.letter_mail_outbox
  where id = v_job_id and order_id is null and template = 'ORDER_CANCELLATION'
    and payload ->> 'order_number' = v_order_number
    and payload -> 'photo_paths' ->> 0 = v_request_key::text || '/0.jpg';
  if v_count <> 1 then raise exception 'Annuleringsmail of foto-opruiming ontbreekt'; end if;
end;
$$;
rollback;
