-- READ ONLY. No remote inspection has been performed during implementation.
-- Before deployment: inspect the EXISTING admin mechanism, not a replacement.
SELECT p.oid::regprocedure AS signature, p.prosecdef AS security_definer,
       p.proconfig, pg_get_functiondef(p.oid) AS definition,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_can_execute
FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname = 'public' AND p.proname = 'is_admin_user';

-- Questionnaire reads retain their own RLS; Freestyle does not bypass them.
SELECT c.relname, c.relrowsecurity AS rls_enabled, c.relforcerowsecurity AS rls_forced
FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
WHERE n.nspname = 'public' AND c.relname IN ('questionnaires', 'questionnaire_freestyle');

SELECT tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public' AND tablename IN ('questionnaires', 'questionnaire_freestyle');

SELECT table_name, grantor, grantee, privilege_type
FROM information_schema.table_privileges
WHERE table_schema = 'public' AND table_name IN ('questionnaires', 'questionnaire_freestyle');

SELECT table_name, grantor, grantee, column_name, privilege_type
FROM information_schema.column_privileges
WHERE table_schema = 'public' AND table_name IN ('questionnaires', 'questionnaire_freestyle')
ORDER BY table_name, grantee, column_name, privilege_type;

-- Read-only inspection. Never alter the questionnaire version guard.
SELECT t.tgname, pg_get_triggerdef(t.oid) AS trigger_definition,
       pg_get_functiondef(t.tgfoid) AS function_definition
FROM pg_trigger t
WHERE t.tgrelid IN (
  SELECT c.oid FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
  WHERE n.nspname = 'public' AND c.relname IN ('questionnaires', 'questionnaire_freestyle')
) AND NOT t.tgisinternal;
