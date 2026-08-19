create table if not exists public.app_settings (
  key text primary key,
  value jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users(id) on delete set null
);

alter table public.app_settings enable row level security;

drop policy if exists "Authenticated users can read app settings" on public.app_settings;
create policy "Authenticated users can read app settings"
on public.app_settings
for select
to authenticated
using (true);

drop policy if exists "Admins can insert app settings" on public.app_settings;
create policy "Admins can insert app settings"
on public.app_settings
for insert
to authenticated
with check ((select private.is_admin()));

drop policy if exists "Admins can update app settings" on public.app_settings;
create policy "Admins can update app settings"
on public.app_settings
for update
to authenticated
using ((select private.is_admin()))
with check ((select private.is_admin()));

drop policy if exists "Admins can delete app settings" on public.app_settings;
create policy "Admins can delete app settings"
on public.app_settings
for delete
to authenticated
using ((select private.is_admin()));

insert into public.app_settings (key, value)
values (
  'feature_visibility',
  '{"vierdaagseNavigation": false, "sinterklaasNavigation": true}'::jsonb
)
on conflict (key) do nothing;
