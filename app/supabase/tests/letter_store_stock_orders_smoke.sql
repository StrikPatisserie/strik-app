-- Controleert per-winkel vervangen, productie-optelling en deadlineblokkade.
begin;

do $$
declare
  v_batch_id uuid;
  v_product_id uuid;
  v_actor_id uuid;
  v_original_deadline timestamptz;
begin
  select id, order_deadline_at into v_batch_id, v_original_deadline
  from public.letter_production_batches
  where production_date = date '2026-11-17';

  select id into v_product_id
  from public.letter_products
  where letter = 'S' and flavour = 'melk' and size = 'groot' and style = 'spuit';

  if v_batch_id is null or v_product_id is null then
    raise exception 'Testdata voor winkelvoorraad ontbreekt';
  end if;

  update public.letter_production_batches
  set status = 'OPEN', order_deadline_at = now() + interval '1 day'
  where id = v_batch_id;

  perform public.letter_replace_store_stock_order(
    v_batch_id,
    'heyendaal',
    jsonb_build_array(jsonb_build_object('product_id', v_product_id, 'quantity', 7)),
    v_actor_id
  );

  if not exists (
    select 1 from public.letter_store_stock_order_items
    where batch_id = v_batch_id and location_code = 'heyendaal'
      and product_id = v_product_id and quantity = 7
  ) then
    raise exception 'Winkelregel werd niet opgeslagen';
  end if;

  perform public.letter_replace_store_stock_order(
    v_batch_id,
    'heyendaal',
    jsonb_build_array(jsonb_build_object('product_id', v_product_id, 'quantity', 4)),
    v_actor_id
  );

  if not exists (
    select 1 from public.letter_store_stock_order_items
    where batch_id = v_batch_id and location_code = 'heyendaal'
      and product_id = v_product_id and quantity = 4
  ) then
    raise exception 'Winkelregel werd niet gewijzigd';
  end if;

  update public.letter_production_batches
  set order_deadline_at = now() - interval '1 minute'
  where id = v_batch_id;

  begin
    perform public.letter_replace_store_stock_order(v_batch_id, 'heyendaal', '[]'::jsonb, v_actor_id);
    raise exception 'Wijzigen na de deadline werd toegestaan';
  exception
    when others then
      if sqlerrm = 'Wijzigen na de deadline werd toegestaan' then raise; end if;
  end;

  update public.letter_production_batches
  set order_deadline_at = v_original_deadline
  where id = v_batch_id;
end;
$$;

rollback;
