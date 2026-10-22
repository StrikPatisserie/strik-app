begin;

create table if not exists public.wedding_booking_archives (
  sha256 text primary key check (sha256 ~ '^[a-f0-9]{64}$'),
  snapshot jsonb not null,
  imported_at timestamptz not null default now(),
  imported_by uuid references auth.users(id)
);

create table if not exists public.wedding_booking_settings (
  singleton boolean primary key default true check (singleton),
  enabled boolean not null default false,
  weekdays integer[] not null default array[2,3,4,5,6],
  times text[] not null default array['10:30','11:30'],
  minimum_notice_minutes integer not null default 0 check (minimum_notice_minutes between 0 and 10080),
  advance_days integer not null default 365 check (advance_days between 7 and 730),
  migration_sha256 text references public.wedding_booking_archives(sha256),
  migration_count integer not null default 0,
  updated_at timestamptz not null default now()
);
insert into public.wedding_booking_settings (singleton) values (true) on conflict do nothing;

create table if not exists public.wedding_appointments (
  id uuid primary key default gen_random_uuid(),
  reference text not null unique default ('BA-' || upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 10))),
  request_id uuid unique,
  source text not null check (source in ('app','wordpress')),
  source_id text,
  source_booking_id text,
  archive_sha256 text references public.wedding_booking_archives(sha256),
  appointment_date date not null,
  start_time time not null,
  end_time time not null check (end_time > start_time),
  status text not null check (status in ('confirmed','pending','cancelled','trash')),
  names text not null,
  email text not null default '',
  phone text not null default '',
  wedding_date date,
  guests integer check (guests between 1 and 2000),
  notes text not null default '',
  raw_source jsonb,
  rate_key text,
  revision integer not null default 1,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, source_id)
);
create index if not exists wedding_appointments_calendar on public.wedding_appointments (appointment_date, start_time);
create index if not exists wedding_appointments_rate on public.wedding_appointments (rate_key, created_at) where source='app';

create table if not exists public.wedding_appointment_blocks (
  id uuid primary key default gen_random_uuid(),
  block_date date not null,
  active boolean not null default true,
  reason text not null default '',
  source_id text unique,
  raw_source jsonb,
  created_at timestamptz not null default now()
);
alter table public.wedding_appointment_blocks add column if not exists active boolean not null default true;
create index if not exists wedding_appointment_blocks_calendar on public.wedding_appointment_blocks (block_date);

create table if not exists public.wedding_appointment_mail_outbox (
  id uuid primary key default gen_random_uuid(),
  appointment_id uuid not null references public.wedding_appointments(id),
  template text not null check (template in ('CUSTOMER_CONFIRMATION','INTERNAL_CONFIRMATION','CUSTOMER_REMINDER')),
  status text not null default 'PENDING' check (status in ('PENDING','SENDING','FAILED','SENT','SKIPPED')),
  revision integer not null default 1,
  available_at timestamptz not null default now(),
  attempts integer not null default 0,
  last_attempt_at timestamptz,
  sent_at timestamptz,
  last_error text,
  created_at timestamptz not null default now(),
  unique (appointment_id, template, revision)
);

alter table public.wedding_booking_archives enable row level security;
alter table public.wedding_booking_settings enable row level security;
alter table public.wedding_appointments enable row level security;
alter table public.wedding_appointment_blocks enable row level security;
alter table public.wedding_appointment_mail_outbox enable row level security;
revoke all on public.wedding_booking_archives, public.wedding_booking_settings, public.wedding_appointments, public.wedding_appointment_blocks, public.wedding_appointment_mail_outbox from anon, authenticated;
grant all on public.wedding_booking_archives, public.wedding_booking_settings, public.wedding_appointments, public.wedding_appointment_blocks, public.wedding_appointment_mail_outbox to service_role;

create or replace function public.strik_book_wedding_appointment(p_date date, p_time time, p_request_id uuid, p_customer jsonb, p_rate_key text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  settings wedding_booking_settings;
  existing wedding_appointments;
  booked wedding_appointments;
  finish time := p_time + interval '30 minutes';
begin
  perform pg_advisory_xact_lock(hashtext('strik-wedding-booking'));
  select * into existing from wedding_appointments where request_id=p_request_id;
  if found then
    if existing.appointment_date<>p_date or existing.start_time<>p_time or existing.names<>p_customer->>'names' or existing.email<>p_customer->>'email' or existing.phone<>p_customer->>'phone'
      or coalesce(existing.wedding_date::text,'')<>coalesce(p_customer->>'weddingDate','') or coalesce(existing.guests::text,'')<>coalesce(p_customer->>'guests','') or existing.notes<>coalesce(p_customer->>'notes','') then
      raise exception 'Deze boekingsaanvraag is gewijzigd. Controleer de gegevens en probeer opnieuw.' using errcode='P0001';
    end if;
    return to_jsonb(existing);
  end if;
  select * into settings from wedding_booking_settings where singleton for update;
  if not settings.enabled then raise exception 'De afsprakenplanner is nog niet geopend.' using errcode='P0001'; end if;
  if p_request_id is null or coalesce(length(p_customer->>'names'),0) not between 1 and 160 or coalesce(length(p_customer->>'email'),0) not between 3 and 200
    or coalesce(length(p_customer->>'phone'),0) not between 1 and 40 or coalesce(length(p_customer->>'notes'),0)>1500 or coalesce(length(p_rate_key),0)<>64 then
    raise exception 'Controleer de contactgegevens.' using errcode='P0001';
  end if;
  if p_date < (now() at time zone 'Europe/Amsterdam')::date or p_date > (now() at time zone 'Europe/Amsterdam')::date + settings.advance_days
    or not (extract(dow from p_date)::integer = any(settings.weekdays)) or not (to_char(p_time,'HH24:MI') = any(settings.times))
    or ((p_date+p_time) at time zone 'Europe/Amsterdam') <= now()+make_interval(mins=>settings.minimum_notice_minutes) then
    raise exception 'Dit tijdstip is niet meer beschikbaar. Kies een nieuw moment.' using errcode='P0001';
  end if;
  if exists(select 1 from wedding_appointment_blocks where block_date=p_date and active)
    or exists(select 1 from wedding_appointments where appointment_date=p_date and status in ('confirmed','pending') and start_time<finish and end_time>p_time) then
    raise exception 'Dit tijdstip is zojuist geboekt of geblokkeerd. Kies een ander moment.' using errcode='P0001';
  end if;
  if (select count(*) from wedding_appointments where source='app' and rate_key=p_rate_key and created_at>now()-interval '1 hour')>=5 then
    raise exception 'Er zijn kort achter elkaar meerdere afspraken geboekt. Probeer later opnieuw of neem contact met ons op.' using errcode='P0001';
  end if;
  insert into wedding_appointments (request_id,source,appointment_date,start_time,end_time,status,names,email,phone,wedding_date,guests,notes,rate_key)
    values (p_request_id,'app',p_date,p_time,finish,'confirmed',p_customer->>'names',p_customer->>'email',p_customer->>'phone',nullif(p_customer->>'weddingDate','')::date,nullif(p_customer->>'guests','')::integer,coalesce(p_customer->>'notes',''),p_rate_key)
    returning * into booked;
  insert into wedding_appointment_mail_outbox (appointment_id,template) values (booked.id,'CUSTOMER_CONFIRMATION'),(booked.id,'INTERNAL_CONFIRMATION');
  insert into wedding_appointment_mail_outbox (appointment_id,template,available_at) values (booked.id,'CUSTOMER_REMINDER',((booked.appointment_date-1)+time '08:00') at time zone 'Europe/Amsterdam');
  return to_jsonb(booked);
end;
$$;

create or replace function public.strik_import_wedding_archive(p_archive jsonb, p_appointments jsonb, p_blocks jsonb, p_actor uuid, p_enable boolean default false)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  settings wedding_booking_settings;
  original jsonb := (p_archive->>'raw')::jsonb;
  checksum text := p_archive->>'sha256';
  count_original integer := jsonb_array_length(original->'booking');
  count_import integer := jsonb_array_length(p_appointments);
begin
  perform pg_advisory_xact_lock(hashtext('strik-wedding-booking'));
  select * into settings from wedding_booking_settings where singleton for update;
  if settings.enabled then raise exception 'De overname is afgesloten; bestaande afspraken worden niet overschreven.'; end if;
  if p_archive->>'format'<>'strik-wedding-booking-export-v1' or checksum !~ '^[a-f0-9]{64}$' or count_original<>count_import or count_original=0
    or jsonb_array_length(original->'bookingdates')<>(select sum(jsonb_array_length(value->'raw_source'->'dates')) from jsonb_array_elements(p_appointments))
    or (select count(distinct value->>'source_booking_id') from jsonb_array_elements(p_appointments))<>count_original
    or exists(select 1 from jsonb_array_elements(original->'booking') b where not exists(select 1 from jsonb_array_elements(p_appointments) a where a->>'source_booking_id'=b->>'booking_id')) then
    raise exception 'De aantallen van de volledige overname komen niet overeen. Er is niets overgenomen.';
  end if;
  insert into wedding_booking_archives (sha256,snapshot,imported_by) values(checksum,p_archive,p_actor) on conflict do nothing;
  insert into wedding_appointments (source,source_id,source_booking_id,archive_sha256,appointment_date,start_time,end_time,status,names,email,phone,notes,raw_source,created_at,updated_at)
    select 'wordpress',a.source_id,a.source_booking_id,checksum,a.appointment_date,a.start_time,a.end_time,a.status,a.names,a.email,a.phone,a.notes,a.raw_source,a.created_at,a.updated_at
    from jsonb_to_recordset(p_appointments) as a(source_id text,source_booking_id text,appointment_date date,start_time time,end_time time,status text,names text,email text,phone text,notes text,raw_source jsonb,created_at timestamptz,updated_at timestamptz)
    on conflict (source,source_id) do update set archive_sha256=excluded.archive_sha256,appointment_date=excluded.appointment_date,start_time=excluded.start_time,end_time=excluded.end_time,status=excluded.status,names=excluded.names,email=excluded.email,phone=excluded.phone,notes=excluded.notes,raw_source=excluded.raw_source,updated_at=excluded.updated_at;
  update wedding_appointments set status='trash' where source='wordpress' and archive_sha256<>checksum;
  update wedding_appointment_blocks set active=false where source_id like 'wordpress:%';
  insert into wedding_appointment_blocks (block_date,reason,source_id,raw_source)
    select b.block_date,b.reason,b.source_id,b.raw_source from jsonb_to_recordset(p_blocks) as b(block_date date,reason text,source_id text,raw_source jsonb)
    on conflict (source_id) do update set block_date=excluded.block_date,reason=excluded.reason,raw_source=excluded.raw_source,active=true;
  insert into wedding_appointment_mail_outbox (appointment_id,template,revision,available_at)
    select id,'CUSTOMER_REMINDER',revision,((appointment_date-1)+time '08:00') at time zone 'Europe/Amsterdam' from wedding_appointments
    where status='confirmed' and email<>'' and appointment_date>(now() at time zone 'Europe/Amsterdam')::date
    on conflict (appointment_id,template,revision) do update set available_at=excluded.available_at,status='PENDING',last_error=null
    where wedding_appointment_mail_outbox.status in ('PENDING','FAILED','SKIPPED');
  update wedding_booking_settings set migration_sha256=checksum,migration_count=count_import,enabled=p_enable,updated_at=now() where singleton;
  return jsonb_build_object('bookings',count_import,'dateRows',jsonb_array_length(original->'bookingdates'),'blockedDates',jsonb_array_length(p_blocks),'sha256',checksum,'enabled',p_enable);
end;
$$;

revoke all on function public.strik_book_wedding_appointment(date,time,uuid,jsonb,text) from public,anon,authenticated;
revoke all on function public.strik_import_wedding_archive(jsonb,jsonb,jsonb,uuid,boolean) from public,anon,authenticated;
grant execute on function public.strik_book_wedding_appointment(date,time,uuid,jsonb,text) to service_role;
grant execute on function public.strik_import_wedding_archive(jsonb,jsonb,jsonb,uuid,boolean) to service_role;


-- Staff may use any day/time; all writers share the same overlap lock.
create or replace function public.strik_manage_wedding_appointment(p_id uuid, p_request_id uuid, p_date date, p_start time, p_end time, p_customer jsonb, p_status text, p_notify boolean, p_actor uuid, p_expected_revision integer default null)
returns jsonb language plpgsql security definer set search_path=public as $$
declare
  settings wedding_booking_settings;
  existing wedding_appointments;
  booked wedding_appointments;
begin
  perform pg_advisory_xact_lock(hashtext('strik-wedding-booking'));
  select * into settings from wedding_booking_settings where singleton for update;
  if not settings.enabled then raise exception 'De nieuwe agenda is nog niet geactiveerd.' using errcode='P0001'; end if;
  if p_actor is null or p_status not in ('confirmed','cancelled') or p_date is null or p_start is null or p_end is null or p_end<=p_start
    or coalesce(length(p_customer->>'names'),0) not between 1 and 160 or coalesce(length(p_customer->>'email'),0)>200
    or coalesce(length(p_customer->>'phone'),0)>40 or coalesce(length(p_customer->>'notes'),0)>1500 then
    raise exception 'Controleer datum, begin- en eindtijd en contactgegevens.' using errcode='P0001';
  end if;
  if p_id is not null then
    select * into existing from wedding_appointments where id=p_id for update;
    if not found then raise exception 'Deze afspraak is niet gevonden.' using errcode='P0001'; end if;
    if p_expected_revision is null or p_expected_revision<>existing.revision then raise exception 'Deze afspraak is intussen gewijzigd. Ververs de agenda.' using errcode='P0001'; end if;
  else
    select * into existing from wedding_appointments where request_id=p_request_id;
    if found then
      if existing.appointment_date<>p_date or existing.start_time<>p_start or existing.end_time<>p_end or existing.names<>p_customer->>'names' or existing.email<>coalesce(p_customer->>'email','')
        or existing.phone<>coalesce(p_customer->>'phone','') or existing.notes<>coalesce(p_customer->>'notes','') or coalesce(existing.wedding_date::text,'')<>coalesce(p_customer->>'weddingDate','') or coalesce(existing.guests::text,'')<>coalesce(p_customer->>'guests','') then
        raise exception 'Deze aanvraag is gewijzigd; controleer de gegevens.' using errcode='P0001';
      end if;
      return to_jsonb(existing);
    end if;
    if p_request_id is null or p_status<>'confirmed' then raise exception 'Controleer de nieuwe afspraak.' using errcode='P0001'; end if;
  end if;
  if p_status='confirmed' and exists(select 1 from wedding_appointments where appointment_date=p_date and status in ('confirmed','pending') and start_time<p_end and end_time>p_start and (p_id is null or id<>p_id)) then
    raise exception 'Dit tijdvak overlapt een andere afspraak. Kies een vrij moment.' using errcode='P0001';
  end if;
  if p_id is null then
    insert into wedding_appointments (request_id,source,appointment_date,start_time,end_time,status,names,email,phone,wedding_date,guests,notes,created_by)
      values(p_request_id,'app',p_date,p_start,p_end,'confirmed',p_customer->>'names',coalesce(p_customer->>'email',''),coalesce(p_customer->>'phone',''),nullif(p_customer->>'weddingDate','')::date,nullif(p_customer->>'guests','')::integer,coalesce(p_customer->>'notes',''),p_actor) returning * into booked;
  else
    update wedding_appointments set appointment_date=p_date,start_time=p_start,end_time=p_end,status=p_status,names=p_customer->>'names',email=coalesce(p_customer->>'email',''),phone=coalesce(p_customer->>'phone',''),wedding_date=nullif(p_customer->>'weddingDate','')::date,guests=nullif(p_customer->>'guests','')::integer,notes=coalesce(p_customer->>'notes',''),revision=revision+1,updated_at=now() where id=p_id returning * into booked;
    update wedding_appointment_mail_outbox set status='SKIPPED',last_error='Afspraak gewijzigd of geannuleerd.' where appointment_id=p_id and status in ('PENDING','FAILED');
  end if;
  if booked.status='confirmed' then
    insert into wedding_appointment_mail_outbox (appointment_id,template,revision) values(booked.id,'INTERNAL_CONFIRMATION',booked.revision);
    if p_notify and booked.email<>'' then insert into wedding_appointment_mail_outbox (appointment_id,template,revision) values(booked.id,'CUSTOMER_CONFIRMATION',booked.revision); end if;
    if booked.email<>'' and booked.appointment_date>(now() at time zone 'Europe/Amsterdam')::date then
      insert into wedding_appointment_mail_outbox (appointment_id,template,revision,available_at) values(booked.id,'CUSTOMER_REMINDER',booked.revision,((booked.appointment_date-1)+time '08:00') at time zone 'Europe/Amsterdam');
    end if;
  end if;
  return to_jsonb(booked);
end;
$$;
revoke all on function public.strik_manage_wedding_appointment(uuid,uuid,date,time,time,jsonb,text,boolean,uuid,integer) from public,anon,authenticated;
grant execute on function public.strik_manage_wedding_appointment(uuid,uuid,date,time,time,jsonb,text,boolean,uuid,integer) to service_role;

commit;
