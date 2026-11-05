begin;
create table if not exists public.logistics_road_request_gate (id boolean primary key default true check(id),next_allowed_at timestamptz not null default '-infinity');
alter table public.logistics_road_request_gate enable row level security;
revoke all on public.logistics_road_request_gate from public,anon,authenticated;
grant all on public.logistics_road_request_gate to service_role;
insert into public.logistics_road_request_gate(id) values(true) on conflict do nothing;
create or replace function public.logistics_claim_road_request() returns boolean language plpgsql security invoker set search_path=public as $$
begin
 update public.logistics_road_request_gate set next_allowed_at=clock_timestamp()+interval '1100 milliseconds' where id=true and next_allowed_at<=clock_timestamp();
 return found;
end;
$$;
revoke all on function public.logistics_claim_road_request() from public,anon,authenticated;
grant execute on function public.logistics_claim_road_request() to service_role;
commit;
