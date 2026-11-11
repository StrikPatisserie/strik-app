-- Actual production can be registered while the order list is still open.
-- Existing timestamps keep historical lists frozen. Only new provisional
-- lists explicitly store NULL until the order deadline.
alter table public.letter_production_checklists
  alter column locked_at drop not null;
