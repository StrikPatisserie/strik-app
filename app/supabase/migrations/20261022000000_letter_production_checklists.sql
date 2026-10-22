-- One frozen working list per round. Production checkmarks are independent of
-- payment, collection, stock distribution and order fulfilment.
create table if not exists public.letter_production_checklists (
  batch_id uuid primary key references public.letter_production_batches(id) on delete restrict,
  rows jsonb not null check (jsonb_typeof(rows) = 'array'),
  revision integer not null default 1 check (revision > 0),
  plan_revision integer not null default 1 check (plan_revision > 0),
  locked_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  updated_by uuid references public.profiles(id) on delete set null
);
alter table public.letter_production_checklists add column if not exists plan_revision integer not null default 1 check (plan_revision > 0);
alter table public.letter_production_checklists enable row level security;
revoke all on public.letter_production_checklists from anon, authenticated;
grant select, insert, update on public.letter_production_checklists to service_role;
