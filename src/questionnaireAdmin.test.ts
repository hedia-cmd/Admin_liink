import supabase from './supabaseClient';
import { activateQuestionnaire, duplicateQuestionnaire, createQuestionnaireDraft, deactivateQuestionnaire } from './questionnaireAdmin';
jest.mock('./supabaseClient', () => ({ __esModule: true, default: { rpc: jest.fn() } }));
beforeEach(() => jest.resetAllMocks());
test('server rejection prevents activation even if UI prevalidation passed', async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: false });
  await expect(activateQuestionnaire('q')).rejects.toThrow('7 × 5');
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});
test('publication uses existing lifecycle RPC after strict server validation', async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: true });
  await activateQuestionnaire('q');
  expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'activate_questionnaire_version', { p_questionnaire_id: 'q' });
});
test('retired correction calls draft duplication, never a direct content update', async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: 'new-draft' });
  expect(await duplicateQuestionnaire('retired')).toBe('new-draft');
  expect(supabase.rpc).toHaveBeenCalledWith('duplicate_questionnaire_draft', { p_source_id: 'retired' });
});

test('editorial activation uses its isolated RPC after the same strict predicate', async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: true });
  await activateQuestionnaire('editorial', 'editorial');
  expect(supabase.rpc).toHaveBeenNthCalledWith(1, 'questionnaire_structure_is_7x5', { p_questionnaire_id: 'editorial' });
  expect(supabase.rpc).toHaveBeenNthCalledWith(2, 'activate_editorial_questionnaire_version', { p_questionnaire_id: 'editorial' });
});
test('invalid editorial draft cannot activate', async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: false });
  await expect(activateQuestionnaire('editorial', 'editorial')).rejects.toThrow('7 × 5');
  expect(supabase.rpc).toHaveBeenCalledTimes(1);
});
test('explicit editorial creation requires no theme and stores no kind or Freestyle flag', async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: 'draft' });
  expect(await createQuestionnaireDraft({ title: 'Joyce', category_id: 'literature', editorial: true })).toBe('draft');
  expect(supabase.rpc).toHaveBeenCalledWith('create_editorial_questionnaire_draft', { p_category_id: 'literature', p_title: 'Joyce' });
});
test('Main creation never infers editorial from a missing theme', async () => {
  await expect(createQuestionnaireDraft({ title: 'Main', category_id: 'cat', theme_id: null })).rejects.toThrow('thématique');
  expect(supabase.rpc).not.toHaveBeenCalled();
});
test('Main creation keeps its existing RPC and associations', async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: 'draft' });
  await createQuestionnaireDraft({ title: 'Main', category_id: 'cat', theme_id: 'theme' });
  expect(supabase.rpc).toHaveBeenCalledWith('create_questionnaire_draft', { p_category_id: 'cat', p_theme_id: 'theme', p_title: 'Main' });
});
test('both kinds reuse existing deactivation', async () => {
  (supabase.rpc as jest.Mock).mockResolvedValue({ data: null });
  await deactivateQuestionnaire('active');
  expect(supabase.rpc).toHaveBeenCalledWith('deactivate_questionnaire_version', { p_questionnaire_id: 'active' });
});
