-- Eenmalige correctie: de startverdeling van 30 september 2026 is eerst
-- alleen onder Ziekerstraat ingevoerd, terwijl alle vier winkels exact
-- dezelfde voorraad hebben ontvangen. Alleen volledig lege winkellijsten
-- worden aangevuld, zodat reeds ingevoerde gegevens nooit worden overschreven.
begin;

do $$
declare
  v_distribution_id uuid;
  v_inserted integer := 0;
begin
  select distribution.id
  into v_distribution_id
  from public.letter_store_start_distributions distribution
  where distribution.season = 2026
    and distribution.distribution_date = date '2026-09-30'
  limit 1;

  if v_distribution_id is null then
    raise notice 'Geen startverdeling voor 30-09-2026 gevonden; niets gewijzigd.';
    return;
  end if;

  insert into public.letter_store_start_distribution_items (
    distribution_id,
    location_code,
    product_id,
    quantity
  )
  select
    source.distribution_id,
    target.location_code,
    source.product_id,
    source.quantity
  from public.letter_store_start_distribution_items source
  cross join (
    values ('heyendaal'), ('daalseweg'), ('lent')
  ) as target(location_code)
  where source.distribution_id = v_distribution_id
    and source.location_code = 'ziekerstraat'
    and not exists (
      select 1
      from public.letter_store_start_distribution_items existing
      where existing.distribution_id = v_distribution_id
        and existing.location_code = target.location_code
    )
  on conflict (distribution_id, location_code, product_id) do nothing;

  get diagnostics v_inserted = row_count;

  if v_inserted > 0 then
    update public.letter_store_start_distributions
    set updated_at = now()
    where id = v_distribution_id;

    insert into public.letter_audit_events (
      entity_type,
      entity_id,
      action,
      details,
      actor_id
    ) values (
      'store_start_distribution',
      v_distribution_id,
      'initial_distribution_copied_to_all_shops',
      jsonb_build_object(
        'source_shop', 'ziekerstraat',
        'target_shops', jsonb_build_array('heyendaal', 'daalseweg', 'lent'),
        'inserted_rows', v_inserted
      ),
      null
    );
  end if;
end;
$$;

commit;
