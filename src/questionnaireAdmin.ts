import supabase from './supabaseClient';
import { EditorialQuestion } from './questionnaireStructure';

export async function readStructure(id: string): Promise<{ questions: EditorialQuestion[]; valid: boolean }> {
  const [content, validation] = await Promise.all([
    supabase.from('questions').select('id,text,order_index,choices(id,text,value,order_index)').eq('questionnaire_id', id).order('order_index').order('id'),
    supabase.rpc('questionnaire_structure_is_7x5', { p_questionnaire_id: id }),
  ]);
  if (content.error || validation.error) throw new Error((content.error || validation.error)!.message);
  return { questions: (content.data || []) as EditorialQuestion[], valid: validation.data === true };
}

export async function activateQuestionnaire(id: string, kind: 'main' | 'editorial' = 'main') {
  const { data, error } = await supabase.rpc('questionnaire_structure_is_7x5', { p_questionnaire_id: id });
  if (error) throw new Error(error.message);
  if (data !== true) throw new Error('Structure incomplète : publication impossible (7 × 5 requis).');
  // The lifecycle RPC rechecks the structure server-side in the activation transaction.
  const result = await supabase.rpc(kind === 'editorial' ? 'activate_editorial_questionnaire_version' : 'activate_questionnaire_version', { p_questionnaire_id: id });
  if (result.error) throw new Error(result.error.message);
}

export async function duplicateQuestionnaire(id: string): Promise<string> {
  const { data, error } = await supabase.rpc('duplicate_questionnaire_draft', { p_source_id: id });
  if (error) throw new Error(error.message);
  return String(data);
}

export async function createQuestionnaireDraft(input: {
  title: string; category_id: string; theme_id?: string | null; editorial?: boolean;
}): Promise<string> {
  // The form-only switch is never stored on questionnaires. Missing a theme
  // cannot silently convert a Main creation request into an editorial one.
  if (!input.editorial && !input.theme_id) throw new Error('Une thématique est requise pour le parcours principal.');
  const result = input.editorial
    ? await supabase.rpc('create_editorial_questionnaire_draft', { p_category_id: input.category_id, p_title: input.title })
    : await supabase.rpc('create_questionnaire_draft', { p_theme_id: input.theme_id, p_category_id: input.category_id, p_title: input.title });
  if (result.error) throw new Error(result.error.message);
  return String(result.data);
}

export async function deactivateQuestionnaire(id: string) {
  const { error } = await supabase.rpc('deactivate_questionnaire_version', { p_questionnaire_id: id });
  if (error) throw new Error(error.message);
}
