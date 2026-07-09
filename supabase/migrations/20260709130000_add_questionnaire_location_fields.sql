alter table public.questionnaires
  add column if not exists region_id uuid references public.regions(id) on delete set null;

alter table public.questionnaires
  add column if not exists city_id uuid references public.cities(id) on delete set null;

create index if not exists idx_questionnaires_region_id
  on public.questionnaires(region_id);

create index if not exists idx_questionnaires_city_id
  on public.questionnaires(city_id);
