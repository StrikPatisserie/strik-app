begin;

create table public.letter_logo_print_jobs (
  id uuid primary key default gen_random_uuid(),
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  items jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 100),
  width_cm numeric not null check (width_cm between 0.5 and 19),
  height_cm numeric not null check (height_cm between 0.5 and 22.5),
  confirmed_at timestamptz,
  confirmed_items uuid[]
);
create index letter_logo_print_jobs_actor_idx on public.letter_logo_print_jobs(created_by);
create table public.letter_logo_print_receipts (
  item_id uuid primary key references public.letter_order_items(id) on delete cascade,
  job_id uuid not null references public.letter_logo_print_jobs(id),
  order_revision integer not null,
  quantity integer not null check (quantity > 0),
  logo_storage_path text not null,
  printed_at timestamptz not null default now(),
  printed_by uuid references public.profiles(id) on delete set null
);
create index letter_logo_print_receipts_job_idx on public.letter_logo_print_receipts(job_id);
create index letter_logo_print_receipts_actor_idx on public.letter_logo_print_receipts(printed_by);
alter table public.letter_logo_print_jobs enable row level security;
alter table public.letter_logo_print_receipts enable row level security;
revoke all on public.letter_logo_print_jobs, public.letter_logo_print_receipts from public, anon, authenticated;
grant select, insert on public.letter_logo_print_jobs to service_role;
grant select, insert, update on public.letter_logo_print_receipts to service_role;
grant update on public.letter_logo_print_jobs to service_role;

-- The authenticated app creates the immutable print job from current order data.
-- Confirmation is atomic, idempotent and rejects orders changed since generation.
create function public.lettershop_confirm_logo_print(p_job_id uuid, p_item_ids uuid[], p_actor_id uuid)
returns timestamptz
language plpgsql security invoker set search_path = public, pg_temp as $$
declare
  v_job public.letter_logo_print_jobs%rowtype;
  v_selected uuid[];
  v_item jsonb;
  v_order public.letter_orders%rowtype;
  v_line public.letter_order_items%rowtype;
  v_now timestamptz := now();
begin
  if p_item_ids is null or cardinality(p_item_ids) not between 1 and 100 then
    raise exception 'Kies de bestellingen die werkelijk geprint zijn.';
  end if;
  select array_agg(distinct x order by x) into v_selected from unnest(p_item_ids) x;
  select * into v_job from letter_logo_print_jobs where id=p_job_id for update;
  if not found or v_job.created_by is distinct from p_actor_id then
    raise exception 'Deze afdruk hoort niet bij jouw printvenster.';
  end if;
  if exists (select 1 from unnest(v_selected) x where not exists (
    select 1 from jsonb_array_elements(v_job.items) j where (j->>'item_id')::uuid=x
  )) then raise exception 'Kies alleen regels uit deze afdruk.'; end if;
  if v_job.confirmed_at is not null then
    if v_job.confirmed_items is distinct from v_selected then
      raise exception 'Deze afdruk is al bevestigd. Open de printlijst opnieuw.';
    end if;
    return v_job.confirmed_at;
  end if;
  -- Follow the lock order used by lettershop_change_quantities.
  perform id from letter_order_items where id=any(v_selected) order by id for update;
  perform id from letter_orders where id in (
    select (j->>'order_id')::uuid from jsonb_array_elements(v_job.items) j
    where (j->>'item_id')::uuid=any(v_selected)
  ) order by id for update;
  for v_item in select j from jsonb_array_elements(v_job.items) j
    where (j->>'item_id')::uuid=any(v_selected)
  loop
    select * into v_line from letter_order_items where id=(v_item->>'item_id')::uuid;
    if not found then raise exception 'Een bestelregel is verwijderd. Open de printlijst opnieuw.'; end if;
    select * into v_order from letter_orders where id=v_line.order_id;
    if not found or v_order.channel <> 'ONLINE' or v_order.fulfillment_status='CANCELLED'
      or v_order.id <> (v_item->>'order_id')::uuid
      or v_order.revision <> (v_item->>'revision')::integer
      or not v_line.logo or v_line.quantity <> (v_item->>'quantity')::integer
      or v_line.product_id <> (v_item->>'product_id')::uuid
      or v_line.logo_storage_path is distinct from v_item->>'logo_storage_path' then
      raise exception 'Een bestelling is intussen gewijzigd. Open de printlijst opnieuw en controleer de afdruk.';
    end if;
    insert into letter_logo_print_receipts(item_id,job_id,order_revision,quantity,logo_storage_path,printed_at,printed_by)
    values (v_line.id,v_job.id,v_order.revision,v_line.quantity,v_line.logo_storage_path,v_now,p_actor_id)
    on conflict(item_id) do update set job_id=excluded.job_id,order_revision=excluded.order_revision,
      quantity=excluded.quantity,logo_storage_path=excluded.logo_storage_path,
      printed_at=excluded.printed_at,printed_by=excluded.printed_by;
  end loop;
  update letter_logo_print_jobs set confirmed_at=v_now,confirmed_items=v_selected where id=v_job.id;
  insert into letter_audit_events(entity_type,entity_id,action,details,actor_id)
    values('logo_print',v_job.id,'PRINT_CONFIRMED',jsonb_build_object('items',v_selected),p_actor_id);
  return v_now;
end;
$$;
revoke all on function public.lettershop_confirm_logo_print(uuid,uuid[],uuid) from public,anon,authenticated;
grant execute on function public.lettershop_confirm_logo_print(uuid,uuid[],uuid) to service_role;
commit;
