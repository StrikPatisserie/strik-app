-- Voorlopige productiedagen. Dit zijn database-instellingen, geen hardcoded app-datums.
-- Bij een latere wijziging moeten bestaande allocaties bewust worden gecontroleerd;
-- een datumwijziging mag nooit stilzwijgend klantorders verplaatsen.
insert into public.letter_production_batches (season, production_date, minimum_lead_days)
values
  (2026, date '2026-11-10', 2),
  (2026, date '2026-11-24', 2),
  (2026, date '2026-12-01', 2)
on conflict (season, production_date) do nothing;

-- Een online bestelling moet een werkelijk beschikbare productiedag hebben.
-- Dezelfde regel geldt bij een latere wijziging van de afhaaldatum.
create or replace function public.lettershop_require_production_day()
returns trigger language plpgsql security invoker set search_path = public as $$
begin
  if new.channel = 'ONLINE' and public.letter_suggest_batch(new.requested_date) is null then
    raise exception 'Voor deze afhaaldatum is nog geen productiedag beschikbaar';
  end if;
  return new;
end;
$$;

create trigger lettershop_require_production_day_before_write
before insert or update of requested_date, channel on public.letter_orders
for each row execute function public.lettershop_require_production_day();
