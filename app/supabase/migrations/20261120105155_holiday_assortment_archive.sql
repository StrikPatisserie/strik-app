-- Year-bound assortment and immutable photo/document objects. Access is through
-- authenticated server routes; the browser never receives database credentials.
create table public.holiday_files (
 id uuid primary key default gen_random_uuid(), season text not null, year integer not null,
 kind text not null check (kind in ('photo','document')), name text not null,
 storage_path text not null unique, content_type text not null,
 size integer not null check (size > 0 and size <= 8388608),
 created_at timestamptz not null default now(), created_by uuid references auth.users(id),
 foreign key(season,year) references public.holiday_seasons(season,year)
);
create index holiday_files_edition on public.holiday_files(season,year,kind);
create table public.holiday_products (
 id uuid primary key default gen_random_uuid(), season text not null, year integer not null,
 name text not null check (length(trim(name)) between 1 and 180),
 variant text not null default '' check (length(variant)<=500),
 category text not null default 'Overig' check (length(category)<=60),
 price_cents integer not null check (price_cents between 0 and 10000000),
 price_includes_vat boolean not null default true,
 photo_id uuid references public.holiday_files(id),
 source_key text not null, source_label text not null default 'Handmatig', source_url text not null default '',
 active boolean not null default true, revision integer not null default 1,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 updated_by uuid references auth.users(id),
 foreign key(season,year) references public.holiday_seasons(season,year),
 unique(season,year,source_key)
);
create index holiday_products_photo on public.holiday_products(photo_id);
alter table public.holiday_files enable row level security;
alter table public.holiday_products enable row level security;
revoke all on public.holiday_files,public.holiday_products from anon,authenticated;
revoke all on public.holiday_files,public.holiday_products from service_role;
grant select,insert on public.holiday_files to service_role;
grant select,insert,update on public.holiday_products to service_role;

create function private.guard_holiday_product() returns trigger language plpgsql security invoker set search_path=public as $$
declare edition_state text;
begin
 if tg_op='UPDATE' and (new.id,new.season,new.year,new.source_key) is distinct from (old.id,old.season,old.year,old.source_key) then raise exception 'Een product blijft bij zijn oorspronkelijke editie.'; end if;
 select state into edition_state from public.holiday_seasons where season=new.season and year=new.year for share;
 if edition_state not in ('active','opening') or edition_state is null then raise exception 'Het assortiment van deze editie is afgesloten.'; end if;
 if new.photo_id is not null and not exists(select 1 from public.holiday_files where id=new.photo_id and kind='photo') then raise exception 'Kies een geldige productfoto.'; end if;
 if tg_op='UPDATE' then new.revision=old.revision+1; new.updated_at=now(); end if;
 return new;
end $$;
revoke all on function private.guard_holiday_product() from public,anon,authenticated;
grant execute on function private.guard_holiday_product() to service_role;
create trigger holiday_product_guard before insert or update on public.holiday_products for each row execute function private.guard_holiday_product();

create function private.snapshot_holiday_assortment() returns trigger language plpgsql security invoker set search_path=public as $$
begin
 new.central=new.central || jsonb_build_object(
  'assortment',(select coalesce(jsonb_agg(to_jsonb(p) order by p.name),'[]'::jsonb) from public.holiday_products p where p.season=new.season and p.year=new.year),
  'seasonFiles',(select coalesce(jsonb_agg(to_jsonb(f)),'[]'::jsonb) from public.holiday_files f where (f.season=new.season and f.year=new.year) or f.id in (select photo_id from public.holiday_products where season=new.season and year=new.year)));
 return new;
end $$;
revoke all on function private.snapshot_holiday_assortment() from public,anon,authenticated;
grant execute on function private.snapshot_holiday_assortment() to service_role;
create trigger holiday_assortment_snapshot before insert on public.holiday_archives for each row execute function private.snapshot_holiday_assortment();

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('holiday-season-files','holiday-season-files',false,8388608,array['image/jpeg','image/png','image/webp','image/gif','application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','text/csv'])
on conflict(id) do nothing;
