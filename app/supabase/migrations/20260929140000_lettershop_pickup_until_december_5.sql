begin;

-- Sinterklaasletters kunnen ieder seizoen uiterlijk op 5 december worden
-- afgehaald. Deze controle staat ook in de applicatie, maar hoort eveneens in
-- de batchselectie zodat handmatige of rechtstreekse verzoeken niet om de
-- grens heen kunnen.
create or replace function public.lettershop_suggest_open_batch(p_requested_date date)
returns uuid language plpgsql security invoker set search_path = public as $$
declare v_batch_id uuid;
begin
  if p_requested_date is null
    or extract(dow from p_requested_date) = 0
    or p_requested_date < (now() at time zone 'Europe/Amsterdam')::date
    or p_requested_date > make_date(extract(year from p_requested_date)::integer, 12, 5) then
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

create or replace function public.letter_suggest_batch(p_requested_date date)
returns uuid language sql stable security invoker set search_path = public as $$
  select id from public.letter_production_batches
  where p_requested_date <= make_date(extract(year from p_requested_date)::integer, 12, 5)
    and season = extract(year from p_requested_date)::integer
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
