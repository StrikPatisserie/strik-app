-- Supplementary runs share the existing checklist revision guard and access rules.
set lock_timeout = '5s';

alter table public.letter_production_checklists
  add column supplements jsonb not null default '[]'::jsonb,
  add constraint letter_production_checklists_supplements_array
    check (jsonb_typeof(supplements) = 'array');

comment on column public.letter_production_checklists.supplements is
  'Supplementary dated letter-production runs with their own demand, actual quantities, recipients and creation audit.';
