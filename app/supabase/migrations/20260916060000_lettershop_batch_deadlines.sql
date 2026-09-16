-- Public orders: order no later than two calendar days before production,
-- pickup no earlier than the batch lead time, and never on Sunday.
-- Dates follow the current batch row, so moving a production day updates availability.
begin;

create or replace function public.lettershop_suggest_open_batch(p_requested_date date)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_batch_id uuid;
begin
  if p_requested_date is null or extract(dow from p_requested_date) = 0
    or p_requested_date < (now() at time zone 'Europe/Amsterdam')::date then
    return null;
  end if;
  select id into v_batch_id from public.letter_production_batches
  where season = extract(year from p_requested_date)::integer
    and status in ('OPEN', 'PLANNED')
    and production_date + minimum_lead_days <= p_requested_date
    and (now() at time zone 'Europe/Amsterdam')::date <= production_date - 2
  order by production_date desc limit 1 for share;
  return v_batch_id;
end;
$$;

revoke all on function public.lettershop_suggest_open_batch(date) from public, anon, authenticated;
grant execute on function public.lettershop_suggest_open_batch(date) to service_role;

create or replace function public.lettershop_require_production_day()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.channel = 'ONLINE' and public.lettershop_suggest_open_batch(new.requested_date) is null then
    raise exception 'Deze afhaaldatum is niet beschikbaar: zondag, verlopen besteldeadline of geen open productiedag';
  end if;
  return new;
end;
$$;

commit;
