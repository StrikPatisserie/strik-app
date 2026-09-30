-- Leg losse winkelverdelingen vast die vóór de centrale productierondes zijn
-- gemaakt. Ze tellen mee in de cumulatief verdeelde winkelvoorraad, maar niet
-- opnieuw in de nog te produceren aantallen.
begin;

create table if not exists public.letter_store_start_distributions (
  id uuid primary key default gen_random_uuid(),
  season integer not null check (season between 2020 and 2100),
  distribution_date date not null,
  created_by uuid references public.profiles(id) on delete set null,
  updated_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (season, distribution_date),
  check (extract(year from distribution_date) = season)
);

create table if not exists public.letter_store_start_distribution_items (
  id uuid primary key default gen_random_uuid(),
  distribution_id uuid not null references public.letter_store_start_distributions(id) on delete cascade,
  location_code text not null check (location_code in ('ziekerstraat', 'heyendaal', 'daalseweg', 'lent')),
  product_id uuid not null references public.letter_products(id) on delete restrict,
  quantity integer not null check (quantity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (distribution_id, location_code, product_id)
);

create index if not exists letter_store_start_distribution_season_idx
  on public.letter_store_start_distributions (season, distribution_date);
create index if not exists letter_store_start_distribution_items_idx
  on public.letter_store_start_distribution_items (distribution_id, location_code);

alter table public.letter_store_start_distributions enable row level security;
alter table public.letter_store_start_distribution_items enable row level security;
revoke all on table public.letter_store_start_distributions from public, anon, authenticated;
revoke all on table public.letter_store_start_distribution_items from public, anon, authenticated;
grant select, insert, update, delete on table public.letter_store_start_distributions to service_role;
grant select, insert, update, delete on table public.letter_store_start_distribution_items to service_role;

create or replace function public.letter_replace_store_start_distribution(
  p_distribution_id uuid,
  p_season integer,
  p_distribution_date date,
  p_lines jsonb,
  p_actor_id uuid
) returns uuid
language plpgsql
security invoker
set search_path = public
as $$
declare
  v_distribution_id uuid;
begin
  if p_season < 2020 or p_season > 2100 then
    raise exception 'Kies een geldig seizoen';
  end if;
  if p_distribution_date is null or extract(year from p_distribution_date)::integer <> p_season then
    raise exception 'De datum moet binnen het gekozen seizoen vallen';
  end if;
  if p_lines is null or jsonb_typeof(p_lines) <> 'array' or jsonb_array_length(p_lines) = 0 then
    raise exception 'Voeg minimaal één letter aan de startverdeling toe';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(location_code text, product_id uuid, quantity integer)
    where line.location_code not in ('ziekerstraat', 'heyendaal', 'daalseweg', 'lent')
      or line.product_id is null
      or line.quantity is null
      or line.quantity <= 0
  ) then
    raise exception 'Controleer winkel, letteruitvoering en aantal';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(location_code text, product_id uuid, quantity integer)
    group by line.location_code, line.product_id
    having count(*) > 1
  ) then
    raise exception 'Een letteruitvoering mag per winkel maar één keer voorkomen';
  end if;
  if exists (
    select 1
    from jsonb_to_recordset(p_lines) as line(location_code text, product_id uuid, quantity integer)
    left join public.letter_products product on product.id = line.product_id
    where product.id is null or not product.active
  ) then
    raise exception 'Een gekozen letteruitvoering is niet beschikbaar';
  end if;
  if exists (
    select 1
    from public.letter_store_start_distributions distribution
    where distribution.season = p_season
      and distribution.distribution_date = p_distribution_date
      and distribution.id is distinct from p_distribution_id
  ) then
    raise exception 'Voor deze datum bestaat al een startverdeling';
  end if;

  if p_distribution_id is null then
    insert into public.letter_store_start_distributions (
      season,
      distribution_date,
      created_by,
      updated_by
    ) values (
      p_season,
      p_distribution_date,
      p_actor_id,
      p_actor_id
    ) returning id into v_distribution_id;
  else
    select id into strict v_distribution_id
    from public.letter_store_start_distributions
    where id = p_distribution_id and season = p_season
    for update;

    update public.letter_store_start_distributions
    set distribution_date = p_distribution_date,
        updated_by = p_actor_id,
        updated_at = now()
    where id = v_distribution_id;
  end if;

  delete from public.letter_store_start_distribution_items
  where distribution_id = v_distribution_id;

  insert into public.letter_store_start_distribution_items (
    distribution_id,
    location_code,
    product_id,
    quantity
  )
  select v_distribution_id, line.location_code, line.product_id, line.quantity
  from jsonb_to_recordset(p_lines) as line(location_code text, product_id uuid, quantity integer);

  insert into public.letter_audit_events (entity_type, entity_id, action, details, actor_id)
  values (
    'store_start_distribution',
    v_distribution_id,
    case when p_distribution_id is null then 'created' else 'replaced' end,
    jsonb_build_object('season', p_season, 'distribution_date', p_distribution_date, 'lines', p_lines),
    p_actor_id
  );

  return v_distribution_id;
end;
$$;

revoke all on function public.letter_replace_store_start_distribution(uuid, integer, date, jsonb, uuid)
  from public, anon, authenticated;
grant execute on function public.letter_replace_store_start_distribution(uuid, integer, date, jsonb, uuid)
  to service_role;

commit;
