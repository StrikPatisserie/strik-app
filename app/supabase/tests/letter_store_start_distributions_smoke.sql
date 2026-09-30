-- Controleert aanmaken, vervangen en winkelverdeling zonder productierondes te
-- beïnvloeden. Alles wordt aan het einde teruggedraaid.
begin;

do $$
declare
  v_distribution_id uuid;
  v_product_id uuid;
  v_batch_stock_before integer;
  v_batch_stock_after integer;
begin
  select id into v_product_id
  from public.letter_products
  where letter = 'S' and flavour = 'melk' and size = 'groot' and style = 'spuit';

  select coalesce(sum(planned_quantity), 0)::integer into v_batch_stock_before
  from public.letter_stock_targets;

  v_distribution_id := public.letter_replace_store_start_distribution(
    null,
    2026,
    date '2026-09-30',
    jsonb_build_array(
      jsonb_build_object('location_code', 'ziekerstraat', 'product_id', v_product_id, 'quantity', 12),
      jsonb_build_object('location_code', 'lent', 'product_id', v_product_id, 'quantity', 6)
    ),
    null
  );

  if not exists (
    select 1 from public.letter_store_start_distribution_items
    where distribution_id = v_distribution_id and location_code = 'ziekerstraat' and quantity = 12
  ) then
    raise exception 'Startverdeling werd niet opgeslagen';
  end if;

  perform public.letter_replace_store_start_distribution(
    v_distribution_id,
    2026,
    date '2026-09-30',
    jsonb_build_array(
      jsonb_build_object('location_code', 'ziekerstraat', 'product_id', v_product_id, 'quantity', 10)
    ),
    null
  );

  if exists (
    select 1 from public.letter_store_start_distribution_items
    where distribution_id = v_distribution_id and location_code = 'lent'
  ) then
    raise exception 'Oude winkelregel bleef na vervangen bestaan';
  end if;

  select coalesce(sum(planned_quantity), 0)::integer into v_batch_stock_after
  from public.letter_stock_targets;
  if v_batch_stock_before <> v_batch_stock_after then
    raise exception 'Startverdeling wijzigde ten onrechte de productieplanning';
  end if;
end;
$$;

rollback;
