-- The public lettershop offers one moulded S card with three chocolate choices.
-- Price follows the existing large-letter price until a separate tariff is set.
insert into public.letter_products (code, letter, flavour, size, style)
values
  ('VORM-MELK-GROOT-S', 'S', 'melk', 'groot', 'vorm'),
  ('VORM-PUUR-GROOT-S', 'S', 'puur', 'groot', 'vorm'),
  ('VORM-WIT-GROOT-S', 'S', 'wit', 'groot', 'vorm')
on conflict (letter, flavour, size, style) do update set active = true;
