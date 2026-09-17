-- Existing profiles keep their status. Only newly created accounts start inactive.
alter table public.profiles alter column active set default false;

create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (
    id, email, full_name, role, store, permissions, active, avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    case
      when new.raw_user_meta_data ->> 'role' in ('winkel', 'ijs', 'bakkerij')
        then new.raw_user_meta_data ->> 'role'
      else 'medewerker'
    end,
    case
      when new.raw_user_meta_data ->> 'role' = 'winkel' then 'winkel'
      when new.raw_user_meta_data ->> 'role' = 'ijs' then 'ijs'
      when new.raw_user_meta_data ->> 'role' = 'bakkerij' then 'bakkerij'
      else null
    end,
    '{}'::jsonb,
    false,
    nullif(new.raw_user_meta_data ->> 'avatar_url', '')
  )
  on conflict (id) do update
  set
    email = excluded.email,
    full_name = coalesce(nullif(excluded.full_name, ''), public.profiles.full_name),
    role = coalesce(nullif(excluded.role, ''), public.profiles.role),
    store = excluded.store,
    permissions = excluded.permissions,
    avatar_url = excluded.avatar_url;

  return new;
end;
$$;
