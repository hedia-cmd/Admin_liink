import { testDataProvider } from 'react-admin';
import { withFreestyle } from './freestyleDataProvider';
import supabase from './supabaseClient';
import { validateSortOrder } from './resources/freestyle/Freestyle';

jest.mock('./supabaseClient', () => ({ __esModule: true, default: { from: jest.fn(), rpc: jest.fn() } }));
const row = { questionnaire_id: 'q1', sort_order: 10, created_at: '2026-09-18' };
function setup(result: any = { data: row, error: null }) {
  const query: any = {};
  for (const name of ['select', 'eq', 'in', 'order', 'range', 'insert', 'update', 'delete']) {
    query[name] = jest.fn(() => query);
  }
  query.single = jest.fn(async () => result);
  query.then = (resolve: any) => Promise.resolve(result).then(resolve);
  (supabase.from as jest.Mock).mockReturnValue(query);
  const base = testDataProvider();
  return { query, provider: withFreestyle(base) };
}
beforeEach(() => { jest.clearAllMocks(); (supabase.rpc as jest.Mock).mockResolvedValue({ data: true }); });

test('reads the schedule sorted and maps questionnaire_id to the UI id', async () => {
  const { query, provider } = setup({ data: [row], count: 1 });
  expect(await provider.getList('questionnaire_freestyle', { pagination: { page: 1, perPage: 25 }, sort: { field: 'sort_order', order: 'ASC' }, filter: {} }))
    .toEqual({ data: [{ ...row, id: 'q1' }], total: 1 });
  expect(query.order).toHaveBeenNthCalledWith(1, 'sort_order', { ascending: true });
  expect(query.range).toHaveBeenCalledWith(0, 24);
});

test('all mutations only touch the programming table and allowlisted columns', async () => {
  const { query, provider } = setup();
  const extra = { category_id: 'do-not-write', status: 'draft', content_version: 99, title: 'do-not-write' };
  await provider.create('questionnaire_freestyle', { data: { ...extra, questionnaire_id: 'q1', sort_order: 10 } });
  expect(query.insert).toHaveBeenCalledWith({ questionnaire_id: 'q1', sort_order: 10 });
  await provider.update('questionnaire_freestyle', { id: 'q1', data: { ...extra, questionnaire_id: 'other', sort_order: 20 }, previousData: { id: 'q1' } });
  expect(query.update).toHaveBeenCalledWith({ sort_order: 20 });
  await provider.delete('questionnaire_freestyle', { id: 'q1' });
  expect(query.eq).toHaveBeenCalledWith('questionnaire_id', 'q1');
  expect((supabase.from as jest.Mock).mock.calls).toEqual(Array(3).fill(['questionnaire_freestyle']));
});

test('duplicate and permission errors are surfaced, without retrying questionnaire writes', async () => {
  const { provider } = setup({ error: { code: '23505', message: 'duplicate' } });
  await expect(provider.create('questionnaire_freestyle', { data: { questionnaire_id: 'q1' } })).rejects.toThrow('déjà programmé');
  const denied = setup({ error: { code: '42501', message: 'permission denied' } });
  await expect(denied.provider.update('questionnaire_freestyle', { id: 'q1', data: { sort_order: 20 }, previousData: { id: 'q1' } })).rejects.toThrow('permission denied');
});

test('order requires an integer within PostgreSQL bounds', () => {
  for (const value of [0, 10, -10, 2147483647]) expect(validateSortOrder(value)).toBeUndefined();
  for (const value of ['', null, undefined, 1.2, 2147483648]) expect(validateSortOrder(value)).toBeDefined();
});

test('invalid questionnaire cannot be scheduled', async () => {
  const { provider, query } = setup();
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: false });
  await expect(provider.create('questionnaire_freestyle', { data: { questionnaire_id: 'bad' } })).rejects.toThrow('7 × 5');
  expect(query.insert).not.toHaveBeenCalled();
});
test('replacement calls atomic RPC without sending a changed order', async () => {
  const { provider, query } = setup();
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: { questionnaire_id: 'new', sort_order: 10 } });
  await provider.update('questionnaire_freestyle', { id: 'old', data: { replacement_questionnaire_id: 'new', sort_order: 90 }, previousData: { id: 'old' } });
  expect(supabase.rpc).toHaveBeenCalledWith('replace_freestyle_questionnaire', { p_old_id: 'old', p_new_id: 'new' });
  expect(query.update).not.toHaveBeenCalled();
});
test('candidate picker reads only the server-validated options', async () => {
  const { provider } = setup();
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: [{ id: 'valid', title: 'Valide' }] });
  const result = await provider.getList('freestyle_questionnaire_options', { pagination: { page: 1, perPage: 25 }, sort: { field: 'title', order: 'ASC' }, filter: { active_only: true } });
  expect(result.data.map(r => r.id)).toEqual(['valid']);
  expect(supabase.rpc).toHaveBeenCalledWith('list_freestyle_questionnaire_options', { p_active_only: true });
});
