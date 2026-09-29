-- Definitieve Lettershop-productierondes 2026.
-- Productie loopt op maandag en dinsdag, bestellen sluit de zondag ervoor
-- exact om 20:00 Europe/Amsterdam en afhalen start op donderdag.
begin;

alter table public.letter_production_batches
  add column if not exists production_start_date date,
  add column if not exists order_deadline_at timestamptz,
  add column if not exists pickup_from_date date;

-- Geef eventuele bestaande seizoenen veilige waarden voordat de definitieve
-- rondes hieronder worden ingevuld.
update public.letter_production_batches
set
  production_start_date = coalesce(production_start_date, production_date),
  order_deadline_at = coalesce(
    order_deadline_at,
    ((production_date - 2) + time '20:00') at time zone 'Europe/Amsterdam'
  ),
  pickup_from_date = coalesce(
    pickup_from_date,
    production_date + minimum_lead_days
  );

insert into public.letter_production_batches (
  season,
  production_start_date,
  production_date,
  minimum_lead_days,
  order_deadline_at,
  pickup_from_date
)
values
  (2026, date '2026-11-02', date '2026-11-03', 2, timestamptz '2026-11-01 20:00:00+01', date '2026-11-05'),
  (2026, date '2026-11-16', date '2026-11-17', 2, timestamptz '2026-11-15 20:00:00+01', date '2026-11-19'),
  (2026, date '2026-11-30', date '2026-12-01', 2, timestamptz '2026-11-29 20:00:00+01', date '2026-12-03')
on conflict (season, production_date) do update
set
  production_start_date = excluded.production_start_date,
  minimum_lead_days = excluded.minimum_lead_days,
  order_deadline_at = excluded.order_deadline_at,
  pickup_from_date = excluded.pickup_from_date,
  updated_at = now();

-- Vervallen voorlopige rondes blijven voor historie bestaan, maar mogen geen
-- nieuwe online bestellingen meer aannemen.
update public.letter_production_batches
set
  status = 'CLOSED',
  closed_at = coalesce(closed_at, now()),
  updated_at = now()
where season = 2026
  and production_date not in (
    date '2026-11-03',
    date '2026-11-17',
    date '2026-12-01'
  )
  and status in ('OPEN', 'PLANNED');

alter table public.letter_production_batches
  drop constraint if exists letter_batches_production_period_check,
  add constraint letter_batches_production_period_check
    check (production_start_date is null or production_start_date <= production_date),
  drop constraint if exists letter_batches_pickup_after_production_check,
  add constraint letter_batches_pickup_after_production_check
    check (pickup_from_date is null or pickup_from_date >= production_date);

-- Online orders use the exact deadline and first pickup date of each round.
create or replace function public.lettershop_suggest_open_batch(p_requested_date date)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_batch_id uuid;
begin
  if p_requested_date is null or extract(dow from p_requested_date) = 0
    or p_requested_date < (now() at time zone 'Europe/Amsterdam')::date then
    return null;
  end if;

  select id into v_batch_id
  from public.letter_production_batches
  where season = extract(year from p_requested_date)::integer
    and status in ('OPEN', 'PLANNED')
    and coalesce(
      pickup_from_date,
      production_date + minimum_lead_days
    ) <= p_requested_date
    and now() <= coalesce(
      order_deadline_at,
      ((production_date - 2) + time '20:00') at time zone 'Europe/Amsterdam'
    )
  order by production_date desc
  limit 1
  for share;

  return v_batch_id;
end;
$$;

-- Interne en handmatige bestellingen volgen dezelfde eerste afhaaldag, maar
-- mogen door medewerkers ook na de openbare online deadline worden gekoppeld.
create or replace function public.letter_suggest_batch(p_requested_date date)
returns uuid language sql stable security invoker set search_path = public as $$
  select id from public.letter_production_batches
  where season = extract(year from p_requested_date)::integer
    and status in ('OPEN', 'PLANNED')
    and coalesce(
      pickup_from_date,
      production_date + minimum_lead_days
    ) <= p_requested_date
  order by production_date desc
  limit 1;
$$;

revoke all on function public.lettershop_suggest_open_batch(date) from public, anon, authenticated;
grant execute on function public.lettershop_suggest_open_batch(date) to service_role;
revoke all on function public.letter_suggest_batch(date) from public, anon, authenticated;
grant execute on function public.letter_suggest_batch(date) to service_role;

commit;
