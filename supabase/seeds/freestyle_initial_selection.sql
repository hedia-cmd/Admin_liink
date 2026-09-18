-- Freestyle V1. Prepared only; execute manually after migration and access audit.
-- Exactly seven explicit UUIDs; Mister Freeze and Mood are not included.
-- Upsert preserves created_at and does not remove other future editorial entries.
BEGIN;

INSERT INTO public.questionnaire_freestyle (questionnaire_id, sort_order)
VALUES
  ('fab64c6f-30eb-45d1-bb56-6355cbfe5b0e'::uuid, 10), -- Godard
  ('9fd3469f-04f0-431b-9497-3560f1646639'::uuid, 20), -- James Joyce
  ('a74cc329-fb37-42ae-baf0-c00e5fba76d6'::uuid, 30), -- Haruki Murakami
  ('16b0b05b-7359-41e3-8f1b-eb9fbb4f2ae0'::uuid, 40), -- Rimbaud
  ('d4768cbd-2507-4b52-867b-5c316714fff5'::uuid, 50), -- William Blake
  ('1f34b08d-edaf-40db-82e5-57b2315991e9'::uuid, 60), -- Comment vois-tu demain ?
  ('eacdf693-5e77-458e-ae3c-f9b32bd64200'::uuid, 70)  -- Dann fon mon kèr
ON CONFLICT (questionnaire_id) DO UPDATE SET sort_order = EXCLUDED.sort_order;

COMMIT;

-- Read-only verification, also usable independently.
SELECT f.questionnaire_id, q.title, f.sort_order
FROM public.questionnaire_freestyle AS f
JOIN public.questionnaires AS q ON q.id = f.questionnaire_id
ORDER BY f.sort_order ASC, f.questionnaire_id;
