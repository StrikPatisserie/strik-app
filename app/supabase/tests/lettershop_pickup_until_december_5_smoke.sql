begin;

do $$
begin
  if public.lettershop_suggest_open_batch(date '2026-12-06') is not null then
    raise exception 'Online afhalen na 5 december werd toegestaan';
  end if;
  if public.letter_suggest_batch(date '2026-12-06') is not null then
    raise exception 'Handmatig afhalen na 5 december werd toegestaan';
  end if;
end;
$$;

rollback;
