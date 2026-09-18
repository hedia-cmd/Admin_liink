// Isolated PostgreSQL/WASM database only. No Supabase connection or credentials.
const { test } = require('node:test');
const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { resolve } = require('node:path');
const { PGlite } = require('@electric-sql/pglite');
const sql = name => readFileSync(resolve(__dirname, '..', name), 'utf8');
const expected = [
  ['fab64c6f-30eb-45d1-bb56-6355cbfe5b0e', 10, 'Godard'],
  ['9fd3469f-04f0-431b-9497-3560f1646639', 20, 'James Joyce'],
  ['a74cc329-fb37-42ae-baf0-c00e5fba76d6', 30, 'Haruki Murakami'],
  ['16b0b05b-7359-41e3-8f1b-eb9fbb4f2ae0', 40, 'Rimbaud'],
  ['d4768cbd-2507-4b52-867b-5c316714fff5', 50, 'William Blake'],
  ['1f34b08d-edaf-40db-82e5-57b2315991e9', 60, 'Comment vois-tu demain ?'],
  ['eacdf693-5e77-458e-ae3c-f9b32bd64200', 70, 'Dann fon mon kèr'],
];
// These UUIDs are synthetic fixtures, never used in the seed or migrations.
const freeze = '00000000-0000-4000-8000-000000000001';
const mood = '00000000-0000-4000-8000-000000000002';
const future = '00000000-0000-4000-8000-000000000003';

test('Freestyle migration, seed and actual PostgreSQL RLS in memory', async t => {
  const db = new PGlite();
  try {
    await db.exec(`
      CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role BYPASSRLS;
      GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
      CREATE TABLE public.questionnaires (
        id uuid PRIMARY KEY, title text, category_id uuid,
        status text DEFAULT 'active', content_version integer DEFAULT 3
      );
      -- Only a test double for the pre-existing deployed admin predicate.
      CREATE FUNCTION public.is_admin_user() RETURNS boolean LANGUAGE sql STABLE AS
      $$ SELECT coalesce(current_setting('test.huekif_admin', true), '') = 'true' $$;
      GRANT SELECT ON public.questionnaires TO anon, authenticated;
    `);
    for (const [id, , title] of [...expected, [freeze, 0, 'Mister Freeze'], [mood, 0, 'Mood — test'], [future, 0, 'Future selection']]) {
      await db.query('INSERT INTO public.questionnaires(id,title,category_id) VALUES ($1,$2,$3)', [id,title,'00000000-0000-4000-8000-000000000099']);
    }
    // Separate test-only write sentinel, NOT the production version guard.
    await db.exec(`
      CREATE FUNCTION public.test_reject_questionnaire_write() RETURNS trigger LANGUAGE plpgsql AS
      $$ BEGIN RAISE EXCEPTION 'Unexpected questionnaire write'; END $$;
      CREATE TRIGGER test_no_questionnaire_write BEFORE INSERT OR UPDATE OR DELETE ON public.questionnaires
      FOR EACH ROW EXECUTE FUNCTION public.test_reject_questionnaire_write();
    `);
    const before = (await db.query('SELECT * FROM public.questionnaires ORDER BY id')).rows;
    await db.exec(sql('migrations/20260918120000_create_questionnaire_freestyle.sql'));
    const read = async () => (await db.query('SELECT questionnaire_id, sort_order FROM public.questionnaire_freestyle ORDER BY sort_order, questionnaire_id')).rows;
    const asRole = async (role, admin = false) => {
      await db.exec('RESET ROLE');
      await db.query("SELECT set_config('test.huekif_admin', $1, false)", [String(admin)]);
      await db.exec(`SET ROLE ${role}`);
    };

    await t.test('seed contains exactly the seven expected UUIDs and revised order; idempotent', async () => {
      await db.exec(sql('seeds/freestyle_initial_selection.sql'));
      const first = (await db.query('SELECT * FROM public.questionnaire_freestyle ORDER BY sort_order')).rows;
      await db.exec(sql('seeds/freestyle_initial_selection.sql'));
      assert.deepEqual((await db.query('SELECT * FROM public.questionnaire_freestyle ORDER BY sort_order')).rows, first);
      assert.deepEqual(await read(), expected.map(([questionnaire_id, sort_order]) => ({ questionnaire_id, sort_order })));
      assert.equal((await db.query('SELECT * FROM public.questionnaire_freestyle WHERE questionnaire_id IN ($1,$2)', [freeze,mood])).rows.length, 0);
    });

    await t.test('anonymous and ordinary authenticated users can read the ordered selection', async () => {
      for (const role of ['anon', 'authenticated']) {
        await asRole(role);
        const result = await db.query(`SELECT f.questionnaire_id, q.title, f.sort_order
          FROM public.questionnaire_freestyle f JOIN public.questionnaires q ON q.id=f.questionnaire_id ORDER BY f.sort_order`);
        assert.deepEqual(result.rows.map(r => r.sort_order), [10,20,30,40,50,60,70]);
      }
    });

    await t.test('ordinary users cannot insert, upsert, delete, reorder or truncate', async () => {
      for (const role of ['anon', 'authenticated']) {
        await asRole(role);
        await assert.rejects(db.query('INSERT INTO public.questionnaire_freestyle(questionnaire_id) VALUES ($1)', [future]));
        await assert.rejects(db.query(`INSERT INTO public.questionnaire_freestyle(questionnaire_id,sort_order) VALUES ($1,99)
          ON CONFLICT (questionnaire_id) DO UPDATE SET sort_order=99`, [expected[0][0]]));
        if (role === 'anon') {
          await assert.rejects(db.exec('UPDATE public.questionnaire_freestyle SET sort_order=99'));
          await assert.rejects(db.exec('DELETE FROM public.questionnaire_freestyle'));
        } else {
          assert.deepEqual((await db.query('UPDATE public.questionnaire_freestyle SET sort_order=99 RETURNING *')).rows, []);
          assert.deepEqual((await db.query('DELETE FROM public.questionnaire_freestyle RETURNING *')).rows, []);
        }
        await assert.rejects(db.exec('TRUNCATE public.questionnaire_freestyle'));
        assert.deepEqual(await read(), expected.map(([questionnaire_id, sort_order]) => ({ questionnaire_id, sort_order })));
      }
    });

    await t.test('existing admin predicate permits add, reorder and remove, but not identity changes', async () => {
      await asRole('authenticated', true);
      await db.query('INSERT INTO public.questionnaire_freestyle(questionnaire_id) VALUES ($1)', [future]);
      assert.equal((await db.query('SELECT sort_order FROM public.questionnaire_freestyle WHERE questionnaire_id=$1', [future])).rows[0].sort_order, 0);
      await db.query('UPDATE public.questionnaire_freestyle SET sort_order=80 WHERE questionnaire_id=$1', [future]);
      assert.equal((await db.query('SELECT sort_order FROM public.questionnaire_freestyle WHERE questionnaire_id=$1', [future])).rows[0].sort_order, 80);
      await assert.rejects(db.query('UPDATE public.questionnaire_freestyle SET questionnaire_id=$1 WHERE questionnaire_id=$2', [mood, future]));
      await db.query('DELETE FROM public.questionnaire_freestyle WHERE questionnaire_id=$1', [future]);
      assert.equal((await read()).length, 7);
    });

    await t.test('all questionnaire data remains unchanged and no questionnaire write was attempted', async () => {
      await db.exec('RESET ROLE');
      assert.deepEqual((await db.query('SELECT * FROM public.questionnaires ORDER BY id')).rows, before);
      const migration = sql('migrations/20260918120000_create_questionnaire_freestyle.sql');
      assert.doesNotMatch(migration, /questionnaire_version_write_guard|ALTER\s+TABLE\s+public\.questionnaires\b/i);
    });
  } finally { await db.close(); }
});
