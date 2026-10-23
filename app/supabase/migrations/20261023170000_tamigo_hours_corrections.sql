begin;

-- Personnel history is separate from general app settings; server access only.
create table if not exists public.tamigo_hours_corrections (
  id uuid primary key,
  actor_id uuid not null references auth.users(id),
  shift_id uuid not null,
  reference jsonb not null,
  before_snapshot jsonb not null,
  after_values jsonb not null,
  original_net_minutes numeric,
  reason text not null check (length(reason) between 3 and 1000),
  mode text not null check (mode in ('proposal','manual')),
  rules_snapshot jsonb,
  update_payload jsonb not null,
  state text not null default 'prepared' check (state in ('prepared','applying','applied','rejected','unknown')),
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  finished_at timestamptz,
  result_message text not null default '',
  observed_snapshot jsonb,
  verified_by uuid references auth.users(id)
);
create index if not exists tamigo_hours_history on public.tamigo_hours_corrections (shift_id, created_at desc);
-- An uncertain request must be reconciled before any new request for this shift.
create unique index if not exists tamigo_hours_one_inflight on public.tamigo_hours_corrections (shift_id) where state in ('applying','unknown');

create table if not exists public.tamigo_hours_correction_events (
  id bigint generated always as identity primary key,
  correction_id uuid not null references public.tamigo_hours_corrections(id),
  state text not null,
  message text not null default '',
  recorded_at timestamptz not null default now(),
  actor_id uuid not null references auth.users(id)
);
alter table public.tamigo_hours_corrections enable row level security;
alter table public.tamigo_hours_correction_events enable row level security;
revoke all on public.tamigo_hours_corrections, public.tamigo_hours_correction_events from public, anon, authenticated, service_role;
grant select, insert, update on public.tamigo_hours_corrections to service_role;
grant select on public.tamigo_hours_correction_events to service_role;

create or replace function public.strik_protect_tamigo_hours_history()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if TG_OP='UPDATE' then
    if (to_jsonb(new)-array['state','finished_at','result_message','observed_snapshot','verified_by']) is distinct from (to_jsonb(old)-array['state','finished_at','result_message','observed_snapshot','verified_by']) then
      raise exception 'Original hours history is immutable';
    end if;
    if not ((old.state='prepared' and new.state='applying') or (old.state='applying' and new.state in ('applied','rejected','unknown')) or (old.state='unknown' and new.state='applied')) then
      raise exception 'Invalid correction state transition';
    end if;
  end if;
  insert into public.tamigo_hours_correction_events(correction_id,state,message,actor_id) values(new.id,new.state,new.result_message,coalesce(new.verified_by,new.actor_id));
  return new;
end;
$$;
revoke all on function public.strik_protect_tamigo_hours_history() from public, anon, authenticated;
drop trigger if exists tamigo_hours_audit on public.tamigo_hours_corrections;
create trigger tamigo_hours_audit after insert or update on public.tamigo_hours_corrections for each row execute function public.strik_protect_tamigo_hours_history();

create or replace function public.strik_claim_tamigo_hours_correction(p_id uuid, p_actor_id uuid)
returns jsonb language plpgsql security definer set search_path = public as $$
declare correction public.tamigo_hours_corrections;
begin
  select * into correction from public.tamigo_hours_corrections where id=p_id for update;
  if not found or correction.actor_id<>p_actor_id then raise exception 'Unknown correction'; end if;
  if correction.state<>'prepared' then return jsonb_build_object('acquired',false,'record',to_jsonb(correction)); end if;
  if correction.expires_at<=now() then raise exception 'Expired correction'; end if;
  perform pg_advisory_xact_lock(hashtextextended(correction.shift_id::text,0));
  if exists (select 1 from public.tamigo_hours_corrections where shift_id=correction.shift_id and state in ('applying','unknown')) then raise exception 'A correction is already in flight or uncertain'; end if;
  update public.tamigo_hours_corrections set state='applying', result_message='Bevestigd door beheerder; bron opnieuw controleren.' where id=p_id returning * into correction;
  return jsonb_build_object('acquired',true,'record',to_jsonb(correction));
end;
$$;
revoke all on function public.strik_claim_tamigo_hours_correction(uuid,uuid) from public, anon, authenticated;
grant execute on function public.strik_claim_tamigo_hours_correction(uuid,uuid) to service_role;

commit;
