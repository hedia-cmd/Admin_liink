ALTER TABLE public.categories
  ADD COLUMN IF NOT EXISTS region_id uuid NULL,
  ADD COLUMN IF NOT EXISTS city_id uuid NULL;

CREATE INDEX IF NOT EXISTS idx_categories_region_id
  ON public.categories (region_id);
