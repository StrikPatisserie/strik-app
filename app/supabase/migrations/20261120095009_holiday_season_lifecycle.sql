-- Lifecycle records contain setup only. Archives contain customer/order data and
-- are read through authenticated management pages, never directly by browsers.
create table public.holiday_seasons (
  season text not null check (season in ('sint','kerst','oud-en-nieuw','pasen','koningsdag','valentijn','moederdag','vaderdag','vierdaagse')),
  year integer not null check (year between 2020 and 2100),
  state text not null check (state in ('opening','active','closing','closed')),
  config jsonb not null default '{}'::jsonb,
  revision integer not null default 1,
  closure_notes jsonb,
  started_at timestamptz,
  closed_at timestamptz,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id),
  primary key (season,year)
);
create unique index holiday_one_open_edition on public.holiday_seasons(season) where state <> 'closed';
create table public.holiday_archives (
  season text not null,
  year integer not null,
  captured_at timestamptz not null default now(),
  captured_by uuid references auth.users(id),
  config jsonb not null,
  notes jsonb not null,
  sources jsonb not null,
  central jsonb not null,
  primary key(season,year),
  foreign key(season,year) references public.holiday_seasons(season,year)
);
alter table public.holiday_seasons enable row level security;
alter table public.holiday_archives enable row level security;
revoke all on public.holiday_seasons,public.holiday_archives from anon,authenticated;
grant select,insert,update on public.holiday_seasons to service_role;
grant select,insert on public.holiday_archives to service_role;

-- Preserve the running 2026 workflows. Future editions require the start wizard.
insert into public.holiday_seasons(season,year,state,config,started_at)
select season,2026,'active',jsonb_build_object('legacy',true,'owner','Management','startDate','2026-01-01','endDate',case when season='oud-en-nieuw' then '2027-01-01' else '2026-12-31' end,'letters',season='sint','business',season in ('sint','kerst'),'mailing',season in ('sint','kerst'),'assortment','Bestaand assortiment 2026','instructions','Bestaande inrichting behouden.','batches','[]'::jsonb),now()
from unnest(array['sint','kerst','oud-en-nieuw']) season;

create function public.holiday_start(p_season text,p_year integer,p_config jsonb,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v public.holiday_seasons; b jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('holiday:'||p_season,0));
  if not exists(select 1 from public.profiles where id=p_actor and active and lower(role) in ('admin','manager','management')) then raise exception 'Geen toegang'; end if;
  select * into v from public.holiday_seasons where season=p_season and year=p_year for update;
  if found then
    if v.state='opening' and v.config=p_config then return to_jsonb(v); end if;
    raise exception 'Deze editie bestaat al. Open het bestaande seizoen of kies een nieuw jaar.';
  end if;
  if p_config->>'owner' is null or p_config->>'startDate' is null or p_config->>'endDate' is null or p_config->>'pricesChecked'<>'true' then raise exception 'Rond de inrichting eerst af.'; end if;
  if (p_config->>'startDate')::date > (p_config->>'endDate')::date or extract(year from (p_config->>'startDate')::date)<>p_year then raise exception 'Controleer de periode.'; end if;
  if p_season='sint' and coalesce((p_config->>'letters')::boolean,false) then
    if jsonb_array_length(p_config->'batches')<1 or exists(select 1 from public.letter_production_batches where season=p_year) then raise exception 'Controleer de productiedagen; bestaande dagen worden niet overschreven.'; end if;
  end if;
  insert into public.holiday_seasons(season,year,state,config,updated_by) values(p_season,p_year,'opening',p_config,p_actor) returning * into v;
  if p_season='sint' and coalesce((p_config->>'letters')::boolean,false) then
    for b in select * from jsonb_array_elements(p_config->'batches') loop
      if extract(year from (b->>'date')::date)<>p_year or (b->>'deadline')::timestamp >= (b->>'start')::date or (b->>'start')::date > (b->>'date')::date or (b->>'date')::date > (b->>'pickup')::date or (b->>'pickup')::date > make_date(p_year,12,5) then raise exception 'Controleer de volgorde van deadline, productie en levering.'; end if;
      insert into public.letter_production_batches(season,production_start_date,production_date,pickup_from_date,order_deadline_at,status,minimum_lead_days)
      values(p_year,(b->>'start')::date,(b->>'date')::date,(b->>'pickup')::date,(b->>'deadline')::timestamp at time zone 'Europe/Amsterdam','PLANNED',2);
    end loop;
  end if;
  return to_jsonb(v);
end $$;

create function public.holiday_finish_close(p_season text,p_year integer,p_sources jsonb,p_notes jsonb,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v public.holiday_seasons; c jsonb='{}';
begin
  select * into v from public.holiday_seasons where season=p_season and year=p_year for update;
  if not exists(select 1 from public.profiles where id=p_actor and active and lower(role) in ('admin','manager','management')) then raise exception 'Geen toegang'; end if;
  if v.state='closed' then return to_jsonb(v); end if;
  if v.state is distinct from 'closing' then raise exception 'Start eerst de afsluiting.'; end if;
  if p_sources->>'complete' is distinct from 'true' or p_notes->>'reviewed' is distinct from 'true' then raise exception 'De afsluiting is niet compleet.'; end if;
  if p_season='sint' then
    c=jsonb_build_object(
      'orders',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.letter_orders x where extract(year from requested_date)=p_year),
      'items',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.letter_order_items x join public.letter_orders o on o.id=x.order_id where extract(year from o.requested_date)=p_year),
      'batches',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.letter_production_batches x where season=p_year),
      'checklists',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.letter_production_checklists x join public.letter_production_batches b on b.id=x.batch_id where b.season=p_year),
      'registrations',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.letter_production_registrations x join public.letter_production_batches b on b.id=x.batch_id where b.season=p_year),
      'allocations',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.letter_production_allocations x join public.letter_production_batches b on b.id=x.batch_id where b.season=p_year),
      'stockTargets',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.letter_stock_targets x join public.letter_production_batches b on b.id=x.batch_id where b.season=p_year),
      'storeOrders',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.letter_store_stock_order_items x join public.letter_production_batches b on b.id=x.batch_id where b.season=p_year),
      'registrationParts',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.letter_production_registration_parts x join public.letter_production_registrations r on r.id=x.registration_id join public.letter_production_batches b on b.id=r.batch_id where b.season=p_year),
      'startDistributions',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.letter_store_start_distributions x where season=p_year),
      'startDistributionItems',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.letter_store_start_distribution_items x join public.letter_store_start_distributions d on d.id=x.distribution_id where d.season=p_year),
      'b2bAssignments',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.letter_b2b_production_assignments x where season=p_year),
      'stockBalances',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.letter_stock_balances x),
      'products',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.letter_products x));
  end if;
  if coalesce(p_notes->>'exceptions','')='' and (
    exists(select 1 from jsonb_array_elements(coalesce(p_sources->'letters','[]')) o where coalesce(o->>'pickedUp','false')<>'true' and coalesce(o->>'status','besteld') not in ('opgehaald','geannuleerd')) or
    exists(select 1 from jsonb_array_elements(coalesce(p_sources->'b2b','[]')) o where o->>'status'='akkoord' and coalesce(o->>'cancelled','false')<>'true' and coalesce(o->>'delivered','false')<>'true') or
    exists(select 1 from jsonb_array_elements(coalesce(c->'orders','[]')) o where o->>'channel'='ONLINE' and o->>'fulfillment_status' not in ('CANCELLED','PICKED_UP','DELIVERED','COMPLETED'))
  ) then raise exception 'Licht de openstaande bestellingen toe voordat je afsluit.'; end if;
  insert into public.holiday_archives(season,year,captured_by,config,notes,sources,central) values(p_season,p_year,p_actor,v.config,p_notes,p_sources,c);
  update public.holiday_seasons set state='closed',closed_at=now(),updated_at=now(),updated_by=p_actor,revision=revision+1 where season=p_season and year=p_year returning * into v;
  return to_jsonb(v);
end $$;
revoke all on function public.holiday_start(text,integer,jsonb,uuid),public.holiday_finish_close(text,integer,jsonb,jsonb,uuid) from public,anon,authenticated;
grant execute on function public.holiday_start(text,integer,jsonb,uuid),public.holiday_finish_close(text,integer,jsonb,jsonb,uuid) to service_role;

-- Row locks make closing wait for central writes already in progress. New writes
-- see the closing state and fail, including requests from an old browser tab.
create function private.guard_letter_season() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
declare y integer; s text; r jsonb;
begin
 for r in select * from jsonb_array_elements(case when tg_op='UPDATE' then jsonb_build_array(to_jsonb(old),to_jsonb(new)) when tg_op='DELETE' then jsonb_build_array(to_jsonb(old)) else jsonb_build_array(to_jsonb(new)) end) loop
   if tg_table_name='letter_orders' then y=extract(year from (r->>'requested_date')::date);
   elsif tg_table_name='letter_order_items' then select extract(year from requested_date) into y from public.letter_orders where id=(r->>'order_id')::uuid;
   elsif tg_table_name in ('letter_production_batches','letter_b2b_production_assignments','letter_store_start_distributions') then y=(r->>'season')::integer;
   elsif tg_table_name='letter_store_start_distribution_items' then select season into y from public.letter_store_start_distributions where id=(r->>'distribution_id')::uuid;
   else select season into y from public.letter_production_batches where id=(r->>'batch_id')::uuid;
   end if;
   select state into s from public.holiday_seasons where season='sint' and year=y for share;
   if y>=2026 and s is distinct from 'active' and not (tg_table_name='letter_production_batches' and tg_op='INSERT' and s='opening') then raise exception 'Dit Sinterklaasseizoen is niet open. Open het via Feestdagen.'; end if;
 end loop;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;
revoke all on function private.guard_letter_season() from public,anon,authenticated;
create trigger holiday_guard before insert or update or delete on public.letter_orders for each row execute function private.guard_letter_season();
create trigger holiday_guard before insert or update or delete on public.letter_order_items for each row execute function private.guard_letter_season();
create trigger holiday_guard before insert or update or delete on public.letter_production_checklists for each row execute function private.guard_letter_season();
create trigger holiday_guard before insert or update or delete on public.letter_production_registrations for each row execute function private.guard_letter_season();
create trigger holiday_guard before insert or update or delete on public.letter_production_allocations for each row execute function private.guard_letter_season();
create trigger holiday_guard before insert or update or delete on public.letter_stock_targets for each row execute function private.guard_letter_season();
create trigger holiday_guard before insert or update or delete on public.letter_store_stock_order_items for each row execute function private.guard_letter_season();
create trigger holiday_guard before insert or update or delete on public.letter_production_batches for each row execute function private.guard_letter_season();
create trigger holiday_guard before insert or update or delete on public.letter_b2b_production_assignments for each row execute function private.guard_letter_season();
create trigger holiday_guard before insert or update or delete on public.letter_store_start_distributions for each row execute function private.guard_letter_season();
create trigger holiday_guard before insert or update or delete on public.letter_store_start_distribution_items for each row execute function private.guard_letter_season();
