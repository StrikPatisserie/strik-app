begin;
create table if not exists public.b2b_order_logos (
  id uuid primary key default gen_random_uuid(),
  order_id text not null check(length(order_id) between 1 and 180),
  season integer not null check(season between 2020 and 2100),
  name text not null check(length(name) between 1 and 180),
  content_type text not null check(content_type in ('image/png','image/jpeg','image/webp','application/pdf')),
  bytes_base64 text not null check(length(bytes_base64) between 1 and 5592408),
  size integer not null check(size between 1 and 4194304),
  quantity integer not null default 1 check(quantity between 0 and 2000),
  width_cm numeric not null default 3 check(width_cm between 0.5 and 19),
  height_cm numeric not null default 3 check(height_cm between 0.5 and 27),
  created_by uuid references public.profiles(id),
  updated_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists b2b_order_logos_order_idx on public.b2b_order_logos(season,order_id);
create index if not exists b2b_order_logos_created_by_idx on public.b2b_order_logos(created_by);
create index if not exists b2b_order_logos_updated_by_idx on public.b2b_order_logos(updated_by);
alter table public.b2b_order_logos enable row level security;
revoke all on public.b2b_order_logos from public,anon,authenticated;
grant all on public.b2b_order_logos to service_role;
comment on table public.b2b_order_logos is 'Private B2B order artwork; access only through authenticated order-scoped server routes. No client table access.';
commit;
