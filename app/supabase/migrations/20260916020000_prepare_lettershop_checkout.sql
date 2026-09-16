-- Run after the two chocolate-letter migrations. This prepares the public
-- lettershop without opening checkout to customers yet.

insert into public.letter_products (code, letter, flavour, size, style)
select 'SPUIT-' || upper(flavour) || '-' || upper(size) || '-' || letter,
       letter, flavour, size, 'spuit'
from (select substr('ABCDEFGHIJKLMNOPQRSTUVWXYZ', n, 1) as letter
      from generate_series(1, 26) as n) as letters
cross join (values ('melk'), ('puur'), ('wit')) as flavours(flavour)
cross join (values ('groot'), ('klein')) as sizes(size)
on conflict (letter, flavour, size, style) do update set active = true;

alter table public.letter_order_items
  add column unit_price_cents integer check (unit_price_cents >= 0),
  add column logo_price_cents integer not null default 0 check (logo_price_cents >= 0),
  add column logo_storage_path text;

create or replace function public.lettershop_set_item_price()
returns trigger language plpgsql set search_path = public as $$
declare
  v_size text;
  v_channel text;
begin
  select size into v_size from public.letter_products where id = new.product_id;
  if v_size is null then raise exception 'Onbekend letterproduct'; end if;
  select channel into v_channel from public.letter_orders where id = new.order_id;
  if v_channel = 'ONLINE' then
    new.unit_price_cents := case v_size when 'groot' then 1395 else 895 end;
    new.logo_price_cents := case when new.logo then 50 else 0 end;
  end if;
  return new;
end;
$$;

create trigger lettershop_item_price_before_insert
before insert on public.letter_order_items
for each row execute function public.lettershop_set_item_price();

-- Private storage: files must only be read through authenticated back-office
-- or a short-lived signed URL. Uploads use the server-side service role.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('lettershop-logos', 'lettershop-logos', false, 10485760,
        array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;
