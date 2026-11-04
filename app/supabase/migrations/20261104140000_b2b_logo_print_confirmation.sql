begin;
alter table public.b2b_order_logos
 add column if not exists printed_at timestamptz,
 add column if not exists printed_by uuid references public.profiles(id),
 add column if not exists printed_by_name text,
 add column if not exists printed_quantity integer,
 add column if not exists printed_width_cm numeric,
 add column if not exists printed_height_cm numeric;
create index if not exists b2b_order_logos_printed_by_idx on public.b2b_order_logos(printed_by);
commit;
