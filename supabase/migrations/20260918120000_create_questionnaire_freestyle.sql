-- Independent editorial schedule. No questionnaire/version/guard changes.
-- Prerequisite: public.is_admin_user() is the existing Huekif admin check
-- used by src/authProvider.ts. Its deployed implementation must be audited.
BEGIN;

CREATE TABLE public.questionnaire_freestyle (
  questionnaire_id uuid PRIMARY KEY REFERENCES public.questionnaires(id) ON DELETE CASCADE,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.questionnaire_freestyle ENABLE ROW LEVEL SECURITY;

-- Override any project default table grants, especially TRUNCATE privileges.
REVOKE ALL ON public.questionnaire_freestyle FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.questionnaire_freestyle TO anon, authenticated;
GRANT INSERT (questionnaire_id, sort_order), UPDATE (sort_order)
  ON public.questionnaire_freestyle TO authenticated;
GRANT DELETE ON public.questionnaire_freestyle TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.questionnaire_freestyle TO service_role;

CREATE POLICY freestyle_read ON public.questionnaire_freestyle
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY freestyle_admin_insert ON public.questionnaire_freestyle
  FOR INSERT TO authenticated WITH CHECK ((SELECT public.is_admin_user()) IS TRUE);
CREATE POLICY freestyle_admin_update ON public.questionnaire_freestyle
  FOR UPDATE TO authenticated
  USING ((SELECT public.is_admin_user()) IS TRUE)
  WITH CHECK ((SELECT public.is_admin_user()) IS TRUE);
CREATE POLICY freestyle_admin_delete ON public.questionnaire_freestyle
  FOR DELETE TO authenticated USING ((SELECT public.is_admin_user()) IS TRUE);

COMMIT;
