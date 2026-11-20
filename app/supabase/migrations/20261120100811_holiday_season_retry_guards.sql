-- Safe retries and closed-by-default writes for unconfigured editions.
create or replace function public.holiday_start(p_season text,p_year integer,p_config jsonb,p_actor uuid)
returns jsonb language plpgsql security invoker set search_path=public as $$
declare v public.holiday_seasons; b jsonb;
begin
  perform pg_advisory_xact_lock(hashtextextended('holiday:'||p_season,0));
  if not exists(select 1 from public.profiles where id=p_actor and active and lower(role) in ('admin','manager','management')) then raise exception 'Geen toegang'; end if;
  select * into v from public.holiday_seasons where season=p_season and year=p_year for update;
  if found then
    if v.state in ('opening','active') and v.config=p_config then return to_jsonb(v); end if;
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


create or replace function private.guard_letter_season() returns trigger language plpgsql security definer set search_path=public,pg_temp as $$
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
   if y>=2026 and s is distinct from 'active' and not (tg_table_name='letter_production_batches' and tg_op='INSERT' and coalesce(s='opening',false)) then raise exception 'Dit Sinterklaasseizoen is niet open. Open het via Feestdagen.'; end if;
 end loop;
 if tg_op='DELETE' then return old; else return new; end if;
end $$;

revoke update,delete,truncate on public.holiday_archives from service_role;
