begin;

-- The direct database API must enforce the same second factor as the app.
-- Preserve the existing database admin role; application managers are authorized
-- separately by the server and do not receive new direct database privileges.
create or replace function private.is_admin()
returns boolean language sql stable security definer set search_path = public
as $$
  select coalesce((select auth.jwt()->>'aal') = 'aal2', false)
    and exists (select 1 from public.profiles where id = (select auth.uid())
      and role = 'admin' and active = true);
$$;
revoke all on function private.is_admin() from public;
grant execute on function private.is_admin() to authenticated;

-- app_settings contains HR, financial and operational documents; it is not a
-- public settings bag. Operational endpoints read through their own server guards.
drop policy if exists "Authenticated users can read app settings" on public.app_settings;
drop policy if exists "Authorized app settings reads" on public.app_settings;
create policy "Authorized app settings reads" on public.app_settings for select to authenticated
using (key = 'feature_visibility' or (select private.is_admin()));

commit;
