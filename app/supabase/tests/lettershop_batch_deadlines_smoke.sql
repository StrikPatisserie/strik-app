-- Read-only checks plus a rolled-back date change. Run after migration 60000.
begin;
do $$
declare v_batch_id uuid;
begin
  select id into v_batch_id from public.letter_production_batches
  where production_date = date '2026-11-10';
  if v_batch_id is null then raise exception 'Batch 10 november ontbreekt'; end if;
  if public.lettershop_suggest_open_batch(date '2026-11-12') is distinct from v_batch_id then
    raise exception '12 november moet beschikbaar zijn';
  end if;
  if public.lettershop_suggest_open_batch(date '2026-11-11') is not null then
    raise exception 'Afhalen voor de productietermijn werd toegestaan';
  end if;
  if public.lettershop_suggest_open_batch(date '2026-11-15') is not null then
    raise exception 'Zondag werd toegestaan';
  end if;
  update public.letter_production_batches set production_date = date '2026-11-11'
  where id = v_batch_id;
  if public.lettershop_suggest_open_batch(date '2026-11-12') is not null then
    raise exception 'Oude eerste afhaaldag bleef beschikbaar';
  end if;
  if public.lettershop_suggest_open_batch(date '2026-11-13') is distinct from v_batch_id then
    raise exception 'Nieuwe eerste afhaaldag schoof niet mee';
  end if;
end;
$$;
rollback;
