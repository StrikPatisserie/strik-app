-- Preserve the requested shop for new, inactive applicants without trusting
-- client-supplied roles or permissions. Existing profiles are untouched.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  requested_role text := new.raw_user_meta_data ->> 'role';
  requested_store text := new.raw_user_meta_data ->> 'store';
begin
  insert into public.profiles (
    id, email, full_name, role, store, permissions, active, avatar_url
  )
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name', ''),
    case when requested_role in ('winkel', 'ijs', 'bakkerij') then requested_role else 'medewerker' end,
    case
      when requested_role = 'winkel' and requested_store in ('ziekerstraat', 'heyendaal', 'daalseweg', 'lent') then requested_store
      when requested_role = 'winkel' then 'winkel'
      when requested_role = 'ijs' then 'ijs'
      when requested_role = 'bakkerij' then 'bakkerij'
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
    role = excluded.role,
    store = excluded.store,
    permissions = excluded.permissions,
    avatar_url = excluded.avatar_url;

  return new;
end;
$$;
