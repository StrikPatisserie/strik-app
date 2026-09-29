-- Read-only checks plus a rolled-back date change. Run after migration 60000.
begin;
do $$
declare v_batch_id uuid;
begin
  select id into v_batch_id from public.letter_production_batches
  where production_date = date '2026-11-17';
  if v_batch_id is null then raise exception 'Productieronde 16/17 november ontbreekt'; end if;
  if (
    select order_deadline_at at time zone 'Europe/Amsterdam'
    from public.letter_production_batches where id = v_batch_id
  ) is distinct from timestamp '2026-11-15 20:00:00' then
    raise exception 'Deadline voor ronde 16/17 november klopt niet';
  end if;
  if public.lettershop_suggest_open_batch(date '2026-11-19') is distinct from v_batch_id then
    raise exception '19 november moet beschikbaar zijn';
  end if;
  if public.lettershop_suggest_open_batch(date '2026-11-18') is not null then
    raise exception 'Afhalen voor de productietermijn werd toegestaan';
  end if;
  if public.lettershop_suggest_open_batch(date '2026-11-22') is not null then
    raise exception 'Zondag werd toegestaan';
  end if;
  update public.letter_production_batches set
    production_start_date = date '2026-11-17',
    production_date = date '2026-11-18',
    pickup_from_date = date '2026-11-20'
  where id = v_batch_id;
  if public.lettershop_suggest_open_batch(date '2026-11-19') is not null then
    raise exception 'Oude eerste afhaaldag bleef beschikbaar';
  end if;
  if public.lettershop_suggest_open_batch(date '2026-11-20') is distinct from v_batch_id then
    raise exception 'Nieuwe eerste afhaaldag schoof niet mee';
  end if;
end;
$$;
rollback;
