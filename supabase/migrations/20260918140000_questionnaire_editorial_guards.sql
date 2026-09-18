-- LOCAL ONLY. Do not deploy while migration history is out of sync.
-- Prerequisites: Freestyle table + existing questionnaire versioning functions.
-- Main lifecycle, strict structure predicate, persistence and write guards stay unchanged.
BEGIN;

-- Generic version lineage, not a Freestyle flag. Original versions keep NULL;
-- COALESCE(version_root_id, id) identifies their family without any backfill.
-- Categories are not version families (e.g. Joyce and Murakami share one).
ALTER TABLE public.questionnaires
  ADD COLUMN version_root_id uuid REFERENCES public.questionnaires(id) ON DELETE RESTRICT;
CREATE UNIQUE INDEX questionnaires_editorial_family_version_unique
  ON public.questionnaires ((coalesce(version_root_id, id)), content_version)
  WHERE theme_id IS NULL AND content_version IS NOT NULL;
CREATE UNIQUE INDEX questionnaires_editorial_family_one_active
  ON public.questionnaires ((coalesce(version_root_id, id)))
  WHERE theme_id IS NULL AND status = 'active';
COMMENT ON COLUMN public.questionnaires.version_root_id IS
  'Editorial version family root; NULL on historical originals. Independent of programming and categories.';

-- Explicit editorial entry point: Main create_questionnaire_draft remains
-- unchanged and still requires a theme/category association.
CREATE FUNCTION public.create_editorial_questionnaire_draft(
  p_category_id uuid,
  p_title text,
  p_source_id uuid DEFAULT NULL
)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_id uuid := gen_random_uuid();
  v_root_id uuid;
  v_source public.questionnaires%rowtype;
  v_version integer := 1;
BEGIN
  IF public.is_questionnaire_admin() IS NOT TRUE THEN
    RAISE insufficient_privilege USING MESSAGE = 'Admin access required';
  END IF;
  IF nullif(btrim(p_title), '') IS NULL OR p_category_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.categories WHERE id = p_category_id) THEN
    RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'HUEKIF_QA_DRAFT_METADATA_INVALID';
  END IF;
  IF p_source_id IS NOT NULL THEN
    SELECT * INTO v_source FROM public.questionnaires WHERE id = p_source_id;
    IF NOT FOUND OR v_source.theme_id IS NOT NULL
       OR v_source.status NOT IN ('active', 'retired')
       OR v_source.category_id IS DISTINCT FROM p_category_id
       OR v_source.content_version IS NULL OR v_source.content_version < 1 THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'HUEKIF_QA_EDITORIAL_SOURCE_INVALID';
    END IF;
    v_root_id := coalesce(v_source.version_root_id, v_source.id);
    -- Serialize allocations within this questionnaire family, not its category.
    PERFORM 1 FROM public.questionnaires WHERE id = v_root_id AND theme_id IS NULL FOR UPDATE;
    IF NOT FOUND THEN
      RAISE EXCEPTION USING ERRCODE = '22023', MESSAGE = 'HUEKIF_QA_EDITORIAL_SOURCE_INVALID';
    END IF;
    SELECT coalesce(max(content_version), 0) + 1 INTO v_version
      FROM public.questionnaires
      WHERE theme_id IS NULL AND coalesce(version_root_id, id) = v_root_id;
  ELSE
    v_root_id := v_id;
  END IF;
  INSERT INTO public.questionnaires (
    id, title, category_id, theme_id, content_version, status,
    version_root_id, created_at, updated_at
  ) VALUES (
    v_id, btrim(p_title), p_category_id, NULL, v_version, 'draft',
    v_root_id, statement_timestamp(), statement_timestamp()
  );
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.create_editorial_questionnaire_draft(uuid, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_editorial_questionnaire_draft(uuid, text, uuid) TO authenticated;

-- No Main mapping is read, retired or created here. Main activation retains
-- its existing API and strict theme/category/7x5 checks.
CREATE FUNCTION public.activate_editorial_questionnaire_version(p_questionnaire_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  v_questionnaire public.questionnaires%rowtype;
  v_root_id uuid;
  v_now timestamptz := statement_timestamp();
BEGIN
  IF public.is_questionnaire_admin() IS NOT TRUE THEN
    RAISE insufficient_privilege USING MESSAGE = 'Admin access required';
  END IF;
  SELECT * INTO v_questionnaire FROM public.questionnaires WHERE id = p_questionnaire_id;
  IF NOT FOUND OR v_questionnaire.theme_id IS NOT NULL THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'HUEKIF_QA_EDITORIAL_ASSOCIATION_INVALID';
  END IF;
  v_root_id := coalesce(v_questionnaire.version_root_id, v_questionnaire.id);
  PERFORM 1 FROM public.questionnaires WHERE id = v_root_id AND theme_id IS NULL FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'HUEKIF_QA_EDITORIAL_ASSOCIATION_INVALID';
  END IF;
  SELECT * INTO v_questionnaire FROM public.questionnaires WHERE id = p_questionnaire_id FOR UPDATE;
  IF NOT FOUND OR v_questionnaire.status <> 'draft' THEN
    RAISE EXCEPTION USING ERRCODE = '55000', MESSAGE = 'HUEKIF_QA_VERSION_NOT_DRAFT';
  END IF;
  IF v_questionnaire.theme_id IS NOT NULL
     OR coalesce(v_questionnaire.version_root_id, v_questionnaire.id) <> v_root_id
     OR v_questionnaire.content_version IS NULL OR v_questionnaire.content_version < 1
     OR v_questionnaire.category_id IS NULL
     OR NOT EXISTS (SELECT 1 FROM public.categories WHERE id = v_questionnaire.category_id) THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'HUEKIF_QA_EDITORIAL_ASSOCIATION_INVALID';
  END IF;
  IF public.questionnaire_structure_is_7x5(p_questionnaire_id) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '23514', MESSAGE = 'HUEKIF_QA_STRUCTURE_INVALID';
  END IF;

  -- The existing write guard recognizes only lifecycle RPC transitions.
  PERFORM set_config('huekif.questionnaire_lifecycle', 'allowed', true);
  UPDATE public.questionnaires SET status = 'retired', deactivated_at = v_now
    WHERE theme_id IS NULL AND coalesce(version_root_id, id) = v_root_id AND status = 'active';
  UPDATE public.questionnaires SET status = 'active', activated_at = v_now, deactivated_at = NULL
    WHERE id = p_questionnaire_id;
  RETURN p_questionnaire_id;
END;
$$;
REVOKE ALL ON FUNCTION public.activate_editorial_questionnaire_version(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.activate_editorial_questionnaire_version(uuid) TO authenticated;

-- deactivate_questionnaire_version already supports both kinds: it only
-- retires the supplied active version and closes any mapping for that UUID.
-- Editorial versions have no Main mapping, so no change to that RPC is needed.


CREATE FUNCTION public.questionnaire_freestyle_structure_guard()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE v_status text;
BEGIN
  SELECT status INTO v_status FROM public.questionnaires
    WHERE id = NEW.questionnaire_id FOR SHARE;
  -- New programming requires an active, immutable and strictly valid version.
  -- Existing retired rows are not rewritten; replace or remove them explicitly.
  IF v_status IS NULL OR v_status <> 'active'
     OR public.questionnaire_structure_is_7x5(NEW.questionnaire_id) IS NOT TRUE THEN
    RAISE EXCEPTION USING ERRCODE = '23514',
      MESSAGE = 'HUEKIF_FREESTYLE_STRUCTURE_INVALID',
      HINT = 'Publier une version strictement 7 questions × 5 choix avant de la programmer.';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.questionnaire_freestyle_structure_guard() FROM PUBLIC;
CREATE TRIGGER questionnaire_freestyle_structure_guard
  BEFORE INSERT OR UPDATE ON public.questionnaire_freestyle
  FOR EACH ROW EXECUTE FUNCTION public.questionnaire_freestyle_structure_guard();

-- Atomic replacement: keeps the exact editorial position. No direct UPDATE
-- privilege on questionnaire_id is granted and existing RLS still applies.
CREATE FUNCTION public.replace_freestyle_questionnaire(p_old_id uuid, p_new_id uuid)
RETURNS public.questionnaire_freestyle
LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_old public.questionnaire_freestyle%rowtype;
        v_new public.questionnaire_freestyle%rowtype;
BEGIN
  IF public.is_admin_user() IS NOT TRUE THEN
    RAISE insufficient_privilege USING MESSAGE = 'Admin access required';
  END IF;
  SELECT * INTO v_old FROM public.questionnaire_freestyle
    WHERE questionnaire_id = p_old_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Freestyle entry not found'; END IF;
  IF p_new_id IS NULL OR p_new_id = p_old_id THEN
    RAISE EXCEPTION 'Choose a different questionnaire';
  END IF;
  PERFORM 1 FROM public.questionnaires WHERE id = p_new_id AND status = 'active' FOR SHARE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Replacement must be an active version';
  END IF;
  -- The trigger rechecks strict 7×5. A duplicate or invalid target rolls back
  -- the entire operation; the old selection remains intact.
  INSERT INTO public.questionnaire_freestyle(questionnaire_id, sort_order)
    VALUES (p_new_id, v_old.sort_order) RETURNING * INTO v_new;
  DELETE FROM public.questionnaire_freestyle WHERE questionnaire_id = p_old_id;
  RETURN v_new;
END;
$$;
REVOKE ALL ON FUNCTION public.replace_freestyle_questionnaire(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.replace_freestyle_questionnaire(uuid, uuid) TO authenticated;

-- Route duplication by the source association; never invent a Main theme.
CREATE FUNCTION public.duplicate_questionnaire_draft(p_source_id uuid)
RETURNS uuid LANGUAGE plpgsql SECURITY INVOKER SET search_path = '' AS $$
DECLARE v_source public.questionnaires%rowtype;
        v_id uuid;
        v_question public.questions%rowtype;
        v_question_id uuid;
BEGIN
  IF public.is_questionnaire_admin() IS NOT TRUE THEN
    RAISE insufficient_privilege USING MESSAGE = 'Admin access required';
  END IF;
  -- No share lock before the family lock: concurrent clones must not both
  -- hold a share lock then attempt to upgrade the same root row.
  SELECT * INTO v_source FROM public.questionnaires WHERE id = p_source_id;
  IF NOT FOUND OR v_source.status NOT IN ('active', 'retired') THEN
    RAISE EXCEPTION 'Source must be an active or retired version';
  END IF;
  IF v_source.theme_id IS NULL THEN
    v_id := public.create_editorial_questionnaire_draft(v_source.category_id, v_source.title, v_source.id);
  ELSE
    v_id := public.create_questionnaire_draft(v_source.theme_id, v_source.category_id, v_source.title);
  END IF;
  UPDATE public.questionnaires SET region_id = v_source.region_id,
    city_id = v_source.city_id, scope = v_source.scope WHERE id = v_id;
  FOR v_question IN SELECT * FROM public.questions WHERE questionnaire_id = p_source_id ORDER BY order_index, id LOOP
    v_question_id := gen_random_uuid();
    INSERT INTO public.questions(id, questionnaire_id, text, order_index)
      VALUES (v_question_id, v_id, v_question.text, v_question.order_index);
    INSERT INTO public.choices(id, questionnaire_id, question_id, text, value, order_index)
      SELECT gen_random_uuid(), v_id, v_question_id, text, value, order_index
      FROM public.choices WHERE question_id = v_question.id;
  END LOOP;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.duplicate_questionnaire_draft(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.duplicate_questionnaire_draft(uuid) TO authenticated;

-- Candidate source for the Admin autocomplete; RLS and existing admin check
-- apply. Invalid historical selections stay visible in the schedule itself.
CREATE FUNCTION public.list_freestyle_questionnaire_options(p_active_only boolean DEFAULT true)
RETURNS TABLE(id uuid, title text, status text)
LANGUAGE sql STABLE SECURITY INVOKER SET search_path = '' AS $$
  SELECT q.id, q.title, q.status FROM public.questionnaires q
  WHERE public.is_admin_user() IS TRUE
    AND q.status = 'active' -- Compatibility parameter cannot opt back into retired versions.
    AND public.questionnaire_structure_is_7x5(q.id)
  ORDER BY q.title, q.id
$$;
REVOKE ALL ON FUNCTION public.list_freestyle_questionnaire_options(boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_freestyle_questionnaire_options(boolean) TO authenticated;

COMMIT;
