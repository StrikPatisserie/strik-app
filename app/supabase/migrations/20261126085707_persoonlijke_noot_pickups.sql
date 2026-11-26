-- Only server routes with current profile/store checks can access pickup data.
create table public.persoonlijke_noot_orders (
  id text primary key check (id ~ '^[a-f0-9]{64}$'),
  edition text not null check (edition ~ '^20[0-9]{2}$'),
  store text not null default '' check (store in ('','ziekerstraat','heyendaal','daalseweg','lent')),
  revision integer not null default 1 check (revision > 0),
  data jsonb not null check (jsonb_typeof(data)='object'),
  updated_at timestamptz not null default now()
);
create index persoonlijke_noot_edition_store on public.persoonlijke_noot_orders(edition,store,id);
alter table public.persoonlijke_noot_orders enable row level security;
revoke all on public.persoonlijke_noot_orders from public,anon,authenticated;
grant select,insert,update,delete on public.persoonlijke_noot_orders to service_role;

-- All selected pickups are marked together, or none if a concurrent change occurred.
create function public.persoonlijke_noot_mark_invoice(p_items jsonb,p_number text,p_actor text)
returns integer language plpgsql security invoker set search_path='' as $$
declare item jsonb; r public.persoonlijke_noot_orders; total integer:=0; stamp timestamptz:=now();
begin
  if jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) not between 1 and 1000 or length(trim(p_number)) not between 1 and 100 then raise exception 'Invalid selection'; end if;
  for item in select value from jsonb_array_elements(p_items) order by value->>'id' loop
    select * into r from public.persoonlijke_noot_orders where id=item->>'id' for update;
    if not found or r.revision<>(item->>'revision')::integer or coalesce(r.data->>'collectedAt','')='' or coalesce(r.data->>'invoiceNumber','')<>'' or coalesce((r.data->>'cancelled')::boolean,false) then raise exception 'Pickup changed'; end if;
    update public.persoonlijke_noot_orders set revision=r.revision+1,updated_at=stamp,
      data=r.data || jsonb_build_object('invoiceNumber',trim(p_number),'invoicedAt',stamp,'events',coalesce(r.data->'events','[]'::jsonb)||jsonb_build_array(jsonb_build_object('at',stamp,'actor',p_actor,'action','invoice','detail',trim(p_number)))) where id=r.id;
    total:=total+1;
  end loop;
  return total;
end; $$;
revoke all on function public.persoonlijke_noot_mark_invoice(jsonb,text,text) from public,anon,authenticated;
grant execute on function public.persoonlijke_noot_mark_invoice(jsonb,text,text) to service_role;
