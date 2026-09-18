// Real PostgreSQL functions in WASM, never a remote database.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const legacy = readFileSync(process.env.HUEKIF_VERSIONING_SQL || resolve(__dirname, '../../../liink/supabase/migrations/20260811160000_thematic_questionnaire_versions.sql'), 'utf8');
const existing = name => {
  const start = legacy.indexOf(`create or replace function public.${name}(`);
  assert.notEqual(start, -1);
  return legacy.slice(start, legacy.indexOf('$function$;', start) + '$function$;'.length);
};
const migration = readFileSync(resolve(__dirname, '../migrations/20260918140000_questionnaire_editorial_guards.sql'), 'utf8');

test('strict publication, immutable version cloning and Freestyle programming', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      CREATE SCHEMA auth;
      CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT null::uuid $$;
      CREATE FUNCTION public.is_admin_user() RETURNS boolean LANGUAGE sql AS $$ SELECT coalesce(current_setting('test.admin', true), '') = 'true' $$;
      CREATE FUNCTION public.is_questionnaire_admin() RETURNS boolean LANGUAGE sql AS $$ SELECT public.is_admin_user() $$;
      SELECT set_config('test.admin', 'true', false);
      CREATE TABLE themes(id uuid PRIMARY KEY DEFAULT gen_random_uuid());
      CREATE TABLE categories(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), theme_id uuid);
      CREATE TABLE questionnaires(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), title text, theme_id uuid, category_id uuid,
        region_id uuid, city_id uuid, scope text, content_version integer, status text DEFAULT 'draft', created_at timestamptz, updated_at timestamptz, activated_at timestamptz, deactivated_at timestamptz);
      CREATE UNIQUE INDEX one_active ON questionnaires(theme_id) WHERE status='active';
      CREATE TABLE questions(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), questionnaire_id uuid REFERENCES questionnaires, text text, order_index integer);
      CREATE TABLE choices(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), questionnaire_id uuid REFERENCES questionnaires, question_id uuid REFERENCES questions, text text, value integer, order_index integer);
      CREATE TABLE mood_responses(questionnaire_id text);
      CREATE TABLE main_theme_questionnaires(id uuid PRIMARY KEY DEFAULT gen_random_uuid(), theme_id uuid, questionnaire_id uuid, score_contract text, activated_at timestamptz, deactivated_at timestamptz, changed_by uuid);
      GRANT USAGE ON SCHEMA public TO authenticated, anon;
      GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
    `);
    for (const name of ['questionnaire_version_has_responses', 'questionnaire_version_write_guard', 'questionnaire_child_write_guard', 'create_questionnaire_draft', 'questionnaire_structure_is_7x5', 'main_questionnaire_is_compatible', 'activate_questionnaire_version', 'deactivate_questionnaire_version']) {
      await db.exec(existing(name));
    }
    await db.exec(`CREATE TRIGGER questionnaire_version_write_guard BEFORE INSERT OR UPDATE OR DELETE ON questionnaires FOR EACH ROW EXECUTE FUNCTION questionnaire_version_write_guard();
      CREATE TRIGGER question_guard BEFORE INSERT OR UPDATE OR DELETE ON questions FOR EACH ROW EXECUTE FUNCTION questionnaire_child_write_guard();
      CREATE TRIGGER choice_guard BEFORE INSERT OR UPDATE OR DELETE ON choices FOR EACH ROW EXECUTE FUNCTION questionnaire_child_write_guard();`);
    await db.exec(readFileSync(resolve(__dirname, '../migrations/20260918120000_create_questionnaire_freestyle.sql'), 'utf8'));
    const fixture = async () => {
      const theme = (await db.query('INSERT INTO themes DEFAULT VALUES RETURNING id')).rows[0].id;
      const category = (await db.query('INSERT INTO categories(theme_id) VALUES($1) RETURNING id', [theme])).rows[0].id;
      const id = (await db.query("SELECT create_questionnaire_draft($1,$2,'Fixture') AS id", [theme, category])).rows[0].id;
      await db.query("INSERT INTO questions(questionnaire_id,text,order_index) SELECT $1,'Question '||i,i FROM generate_series(1,7) i", [id]);
      await db.query("INSERT INTO choices(questionnaire_id,question_id,text,value,order_index) SELECT $1,q.id,'Choix '||i,i,i+1 FROM questions q CROSS JOIN generate_series(0,4) i WHERE q.questionnaire_id=$1", [id]);
      return id;
    };
    // Existing bad scheduled data is retained by the migration for correction.
    const invalidHistorical = await fixture();
    await db.query('UPDATE choices SET value=32 WHERE questionnaire_id=$1 AND value=2', [invalidHistorical]);
    await db.exec('BEGIN');
    await db.exec("SELECT set_config('huekif.questionnaire_lifecycle','allowed',true)");
    await db.query("UPDATE questionnaires SET status='retired' WHERE id=$1", [invalidHistorical]);
    await db.exec('COMMIT');
    await db.query('INSERT INTO questionnaire_freestyle(questionnaire_id,sort_order) VALUES($1,40)', [invalidHistorical]);
    const editorialCategory = (await db.query('INSERT INTO categories DEFAULT VALUES RETURNING id')).rows[0].id;
    const legacyEditorial = async () => {
      const id = (await db.query("INSERT INTO questionnaires(title,category_id,content_version,status) VALUES('Editorial',$1,1,'draft') RETURNING id", [editorialCategory])).rows[0].id;
      await db.query("INSERT INTO questions(questionnaire_id,text,order_index) SELECT $1,'Question '||i,i FROM generate_series(1,7) i", [id]);
      await db.query("INSERT INTO choices(questionnaire_id,question_id,text,value,order_index) SELECT $1,q.id,'Choix '||i,i,i+1 FROM questions q CROSS JOIN generate_series(0,4) i WHERE q.questionnaire_id=$1", [id]);
      await db.query('UPDATE choices SET value=32 WHERE questionnaire_id=$1 AND value=2', [id]);
      await db.exec('BEGIN');
      await db.exec("SELECT set_config('huekif.questionnaire_lifecycle','allowed',true)");
      await db.query("UPDATE questionnaires SET status='retired' WHERE id=$1", [id]);
      await db.exec('COMMIT');
      return id;
    };
    const editorialOriginal = await legacyEditorial();
    const otherEditorial = await legacyEditorial();
    await db.query('INSERT INTO questionnaire_freestyle(questionnaire_id,sort_order) VALUES($1,70)', [editorialOriginal]);
    const contents = async id => ({
      questionnaire: (await db.query('SELECT * FROM questionnaires WHERE id=$1',[id])).rows[0],
      questions: (await db.query('SELECT * FROM questions WHERE questionnaire_id=$1 ORDER BY id',[id])).rows,
      choices: (await db.query('SELECT * FROM choices WHERE questionnaire_id=$1 ORDER BY id',[id])).rows,
    });
    const originalBefore = await contents(editorialOriginal);
    await db.exec(migration);
    // Adding a nullable lineage column does not rewrite original version data.
    assert.deepEqual(await contents(editorialOriginal), {
      ...originalBefore, questionnaire: { ...originalBefore.questionnaire, version_root_id: null },
    });

    for (const [name, change] of [
      ['6 questions', async id => { await db.query('DELETE FROM choices WHERE question_id IN (SELECT id FROM questions WHERE questionnaire_id=$1 AND order_index=7)', [id]); await db.query('DELETE FROM questions WHERE questionnaire_id=$1 AND order_index=7', [id]); }],
      ['4 choices', id => db.query('DELETE FROM choices WHERE id=(SELECT id FROM choices WHERE questionnaire_id=$1 LIMIT 1)', [id])],
      ['duplicate value', id => db.query('UPDATE choices SET value=0 WHERE questionnaire_id=$1 AND value=1', [id])],
      ['duplicate choice order', id => db.query('UPDATE choices SET order_index=1 WHERE questionnaire_id=$1 AND order_index=2', [id])],
      ['duplicate question order', id => db.query('UPDATE questions SET order_index=2 WHERE questionnaire_id=$1 AND order_index=3', [id])],
      ['null value', id => db.query('UPDATE choices SET value=NULL WHERE questionnaire_id=$1 AND value=4', [id])],
    ]) await t.test(`${name}: actual lifecycle RPC rejects publication and scheduling`, async () => {
      const id = await fixture(); await change(id);
      assert.equal((await db.query('SELECT questionnaire_structure_is_7x5($1) AS valid',[id])).rows[0].valid, false);
      await assert.rejects(db.query('SELECT activate_questionnaire_version($1)',[id]), /HUEKIF_QA_STRUCTURE_INVALID/);
      await assert.rejects(db.query('INSERT INTO questionnaire_freestyle(questionnaire_id) VALUES($1)',[id]), /HUEKIF_FREESTYLE_STRUCTURE_INVALID/);
    });

    const good = await fixture();
    await t.test('strict Main draft activates; only active conforming versions can be scheduled', async () => {
      await assert.rejects(db.query('INSERT INTO questionnaire_freestyle(questionnaire_id) VALUES($1)',[good]), /HUEKIF_FREESTYLE_STRUCTURE_INVALID/);
      await db.query('SELECT activate_questionnaire_version($1)',[good]);
      await db.query('INSERT INTO questionnaire_freestyle(questionnaire_id,sort_order) VALUES($1,10)',[good]);
      const options = (await db.query('SELECT * FROM list_freestyle_questionnaire_options(false)')).rows;
      assert.deepEqual(options.map(r => r.id), [good]);
    });
    await t.test('retired content is immutable; clone preserves every text and anomaly on new draft IDs', async () => {
      await assert.rejects(db.query("UPDATE questions SET text='changed' WHERE questionnaire_id=$1", [invalidHistorical]), /HUEKIF_QA_VERSION_IMMUTABLE/);
      await assert.rejects(db.query('UPDATE choices SET value=2 WHERE questionnaire_id=$1', [invalidHistorical]), /HUEKIF_QA_VERSION_IMMUTABLE/);
      const snapshot = async id => (await db.query('SELECT q.text AS question,c.text,c.value,c.order_index FROM questions q JOIN choices c ON c.question_id=q.id WHERE q.questionnaire_id=$1 ORDER BY q.text,c.text',[id])).rows;
      const before = await snapshot(invalidHistorical);
      const draft = (await db.query('SELECT duplicate_questionnaire_draft($1) AS id',[invalidHistorical])).rows[0].id;
      assert.deepEqual(await snapshot(draft), before);
      assert.deepEqual(await snapshot(invalidHistorical), before);
      assert.equal((await db.query('SELECT status FROM questionnaires WHERE id=$1',[draft])).rows[0].status,'draft');
      await db.query('UPDATE choices SET value=2 WHERE questionnaire_id=$1 AND value=32',[draft]);
      await db.query('SELECT activate_questionnaire_version($1)',[draft]);
      await db.exec('SET ROLE authenticated');
      await db.query('SELECT replace_freestyle_questionnaire($1,$2)',[invalidHistorical,draft]);
      await db.exec('RESET ROLE');
      const row = (await db.query('SELECT * FROM questionnaire_freestyle WHERE questionnaire_id=$1',[draft])).rows[0];
      assert.equal(row.sort_order,40);
      assert.deepEqual((await db.query('SELECT * FROM questionnaire_freestyle WHERE questionnaire_id=$1',[invalidHistorical])).rows,[]);
      assert.deepEqual(await snapshot(invalidHistorical),before);
    });
    await t.test('bad insert and replacement are refused without deleting old programming', async () => {
      await assert.rejects(db.query('INSERT INTO questionnaire_freestyle(questionnaire_id) VALUES($1)',[invalidHistorical]), /HUEKIF_FREESTYLE_STRUCTURE_INVALID/);
      await assert.rejects(db.query('SELECT replace_freestyle_questionnaire($1,$2)',[good,invalidHistorical]));
      assert.equal((await db.query('SELECT sort_order FROM questionnaire_freestyle WHERE questionnaire_id=$1',[good])).rows[0].sort_order,10);
    });
    let editorialV2;
    let editorialV3;
    let otherV2;
    const mainMappingsBefore = (await db.query('SELECT * FROM main_theme_questionnaires ORDER BY id')).rows;
    await t.test('Main entry points still reject absent themes and editorial cannot activate Main', async () => {
      await assert.rejects(db.query("SELECT create_questionnaire_draft(NULL,$1,'Main')", [editorialCategory]), /HUEKIF_QA_DRAFT_METADATA_INVALID/);
      const editorialDraft = (await db.query("SELECT create_editorial_questionnaire_draft($1,'New editorial') AS id", [editorialCategory])).rows[0].id;
      await assert.rejects(db.query('SELECT activate_questionnaire_version($1)',[editorialDraft]), /HUEKIF_QA_ASSOCIATION_INVALID/);
      assert.equal((await db.query('SELECT main_questionnaire_is_compatible($1) AS valid',[editorialDraft])).rows[0].valid,false);
      await assert.rejects(db.query('SELECT activate_editorial_questionnaire_version($1)',[good]), /HUEKIF_QA_EDITORIAL_ASSOCIATION_INVALID/);
      await assert.rejects(db.query("SELECT create_editorial_questionnaire_draft(NULL,'Missing category')"), /HUEKIF_QA_DRAFT_METADATA_INVALID/);
    });
    for (const count of [6, 7]) await t.test(`editorial activation rejects ${count === 6 ? '6 questions' : 'one question with 4 choices'}`, async () => {
      const id = (await db.query("SELECT create_editorial_questionnaire_draft($1,'Incomplete') AS id",[editorialCategory])).rows[0].id;
      await db.query("INSERT INTO questions(questionnaire_id,text,order_index) SELECT $1,'Question '||i,i FROM generate_series(1,$2::integer) i",[id,count]);
      await db.query("INSERT INTO choices(questionnaire_id,question_id,text,value,order_index) SELECT $1,q.id,'Choix '||i,i,i+1 FROM questions q CROSS JOIN generate_series(0,4) i WHERE q.questionnaire_id=$1",[id]);
      if (count === 7) await db.query('DELETE FROM choices WHERE id=(SELECT id FROM choices WHERE questionnaire_id=$1 LIMIT 1)',[id]);
      await assert.rejects(db.query('SELECT activate_editorial_questionnaire_version($1)',[id]), /HUEKIF_QA_STRUCTURE_INVALID/);
      assert.equal((await contents(id)).questionnaire.status,'draft');
    });
    await t.test('retired editorial V1 clones to draft V2 without theme or source changes', async () => {
      await db.exec('SET ROLE authenticated');
      editorialV2 = (await db.query('SELECT duplicate_questionnaire_draft($1) AS id',[editorialOriginal])).rows[0].id;
      await db.exec('RESET ROLE');
      const version = (await contents(editorialV2)).questionnaire;
      assert.equal(version.status,'draft'); assert.equal(version.content_version,2);
      assert.equal(version.theme_id,null); assert.equal(version.category_id,editorialCategory);
      assert.equal(version.version_root_id,editorialOriginal);
      const clone = await contents(editorialV2);
      assert.equal(clone.questions.length,7); assert.equal(clone.choices.length,35);
      assert.equal(clone.choices.filter(c => c.value===32).length,7);
      assert.equal(clone.choices.some(c => originalBefore.choices.some(old => old.id===c.id)),false);
      assert.deepEqual(await contents(editorialOriginal), {
        ...originalBefore, questionnaire: { ...originalBefore.questionnaire, version_root_id: null },
      });
      await assert.rejects(db.query('SELECT activate_editorial_questionnaire_version($1)',[editorialV2]), /HUEKIF_QA_STRUCTURE_INVALID/);
      await assert.rejects(db.query('UPDATE choices SET value=2 WHERE questionnaire_id=$1',[editorialOriginal]), /HUEKIF_QA_VERSION_IMMUTABLE/);
    });
    await t.test('corrected editorial draft activates and replacement keeps sort_order', async () => {
      await db.query('UPDATE choices SET value=2 WHERE questionnaire_id=$1 AND value=32',[editorialV2]);
      await db.exec('SET ROLE authenticated');
      await db.query('SELECT activate_editorial_questionnaire_version($1)',[editorialV2]);
      await db.query('SELECT replace_freestyle_questionnaire($1,$2)',[editorialOriginal,editorialV2]);
      await db.exec('RESET ROLE');
      assert.equal((await db.query('SELECT sort_order FROM questionnaire_freestyle WHERE questionnaire_id=$1',[editorialV2])).rows[0].sort_order,70);
      assert.equal((await db.query('SELECT * FROM questionnaire_freestyle WHERE questionnaire_id=$1',[editorialOriginal])).rows.length,0);
      assert.deepEqual((await db.query('SELECT * FROM main_theme_questionnaires ORDER BY id')).rows,mainMappingsBefore);
      assert.deepEqual(await contents(editorialOriginal), {
        ...originalBefore, questionnaire: { ...originalBefore.questionnaire, version_root_id: null },
      });
    });
    await t.test('same category is not a version family; V3 retires only its own V2', async () => {
      otherV2 = (await db.query('SELECT duplicate_questionnaire_draft($1) AS id',[otherEditorial])).rows[0].id;
      await db.query('UPDATE choices SET value=2 WHERE questionnaire_id=$1 AND value=32',[otherV2]);
      await db.query('SELECT activate_editorial_questionnaire_version($1)',[otherV2]);
      // Duplicate the root again: max version is resolved over the whole family.
      editorialV3 = (await db.query('SELECT duplicate_questionnaire_draft($1) AS id',[editorialOriginal])).rows[0].id;
      await db.query('UPDATE choices SET value=2 WHERE questionnaire_id=$1 AND value=32',[editorialV3]);
      await db.query('SELECT activate_editorial_questionnaire_version($1)',[editorialV3]);
      const a = (await contents(editorialV2)).questionnaire;
      const b = (await contents(otherV2)).questionnaire;
      const c = (await contents(editorialV3)).questionnaire;
      assert.equal(a.status,'retired'); assert.equal(b.status,'active'); assert.equal(c.status,'active');
      assert.equal(b.content_version,2); assert.equal(c.content_version,3);
      assert.equal(b.version_root_id,otherEditorial); assert.equal(c.version_root_id,editorialOriginal);
      const v4 = (await db.query('SELECT duplicate_questionnaire_draft($1) AS id',[editorialV2])).rows[0].id;
      assert.equal((await contents(v4)).questionnaire.content_version,4);
      assert.deepEqual((await db.query('SELECT * FROM main_theme_questionnaires ORDER BY id')).rows,mainMappingsBefore);
    });
    await t.test('strict retired versions cannot be newly scheduled even with options(false)', async () => {
      assert.equal((await db.query('SELECT questionnaire_structure_is_7x5($1) AS valid',[editorialV2])).rows[0].valid,true);
      // Existing retired programming is retained until the explicit replacement.
      await db.query('SELECT replace_freestyle_questionnaire($1,$2)',[editorialV2,editorialV3]);
      await assert.rejects(db.query('INSERT INTO questionnaire_freestyle(questionnaire_id) VALUES($1)',[editorialV2]), /HUEKIF_FREESTYLE_STRUCTURE_INVALID/);
      await assert.rejects(db.query('UPDATE questionnaire_freestyle SET questionnaire_id=$1 WHERE questionnaire_id=$2',[editorialV2,editorialV3]), /HUEKIF_FREESTYLE_STRUCTURE_INVALID/);
      const options = (await db.query('SELECT * FROM list_freestyle_questionnaire_options(false)')).rows;
      assert.equal(options.some(q => q.id===editorialV2),false);
      assert.equal(options.every(q => q.status==='active'),true);
      assert.equal((await db.query('SELECT sort_order FROM questionnaire_freestyle WHERE questionnaire_id=$1',[editorialV3])).rows[0].sort_order,70);
    });
    await t.test('existing deactivation supports editorial without touching Main', async () => {
      await db.query('SELECT deactivate_questionnaire_version($1)',[otherV2]);
      assert.equal((await contents(otherV2)).questionnaire.status,'retired');
      assert.equal((await contents(editorialV3)).questionnaire.status,'active');
      assert.deepEqual((await db.query('SELECT * FROM main_theme_questionnaires ORDER BY id')).rows,mainMappingsBefore);
      await assert.rejects(db.query('SELECT activate_editorial_questionnaire_version($1)',[otherV2]), /HUEKIF_QA_VERSION_NOT_DRAFT/);
    });
    await t.test('non-admin cannot clone or replace', async () => {
      await db.exec("SELECT set_config('test.admin','false',false); SET ROLE authenticated;");
      await assert.rejects(db.query('SELECT duplicate_questionnaire_draft($1)',[good]), /Admin access required/);
      await assert.rejects(db.query("SELECT create_editorial_questionnaire_draft($1,'Denied')",[editorialCategory]), /Admin access required/);
      await assert.rejects(db.query('SELECT activate_editorial_questionnaire_version($1)',[editorialV3]), /Admin access required/);
      await assert.rejects(db.query('SELECT replace_freestyle_questionnaire($1,$2)',[good,invalidHistorical]), /Admin access required/);
    });
    assert.doesNotMatch(migration, /CREATE\s+OR\s+REPLACE\s+FUNCTION\s+public\.(questionnaire_structure_is_7x5|persist_active_mood_context|questionnaire_version_write_guard)/i);
  } finally { await db.close(); }
});
