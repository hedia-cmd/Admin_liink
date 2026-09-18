import type { DataProvider } from "react-admin";
import supabase from "./supabaseClient";

const resourceName = "questionnaire_freestyle";
const columns = "questionnaire_id,sort_order,created_at";
const record = (row: any) => ({ ...row, id: row.questionnaire_id });
const check = (error: any) => {
  if (error) throw new Error(error.code === "23505" ? "Ce questionnaire est déjà programmé dans Freestyle." : error.message === 'HUEKIF_FREESTYLE_STRUCTURE_INVALID'
    ? 'Questionnaire non conforme ou non publié : Freestyle exige 7 questions × 5 choix.' : error.message);
};

// The virtual React Admin id is never persisted. Writes only target the schedule.
export function withFreestyle(base: DataProvider): DataProvider {
  return {
    ...base,
    async getList(resource, params): Promise<any> {
      if (resource === 'freestyle_questionnaire_options') {
        const { data, error } = await supabase.rpc('list_freestyle_questionnaire_options', {
          p_active_only: true,
        });
        check(error);
        const search = String(params.filter?.title || '').replace(/%/g, '').toLocaleLowerCase();
        const options = (data || []).filter((row: any) => String(row.title).toLocaleLowerCase().includes(search));
        const { page = 1, perPage = 25 } = params.pagination || {};
        return { data: options.slice((page - 1) * perPage, page * perPage), total: options.length };
      }
      if (resource !== resourceName) return base.getList(resource, params);
      const { page = 1, perPage = 25 } = params.pagination || {};
      const field = params.sort?.field === "questionnaire_id" ? "questionnaire_id" : "sort_order";
      const { data, count, error } = await supabase.from(resourceName)
        .select(columns, { count: "exact" })
        .order(field, { ascending: params.sort?.order !== "DESC" })
        .order("questionnaire_id", { ascending: true })
        .range((page - 1) * perPage, page * perPage - 1);
      check(error);
      return { data: (data || []).map(record), total: count ?? 0 };
    },
    async getOne(resource, params): Promise<any> {
      if (resource !== resourceName) return base.getOne(resource === 'freestyle_questionnaire_options' ? 'questionnaires' : resource, params);
      const { data, error } = await supabase.from(resourceName).select(columns).eq("questionnaire_id", params.id).single();
      check(error);
      return { data: record(data) };
    },
    async getMany(resource, params): Promise<any> {
      if (resource !== resourceName) return base.getMany(resource === 'freestyle_questionnaire_options' ? 'questionnaires' : resource, params);
      const { data, error } = await supabase.from(resourceName).select(columns).in("questionnaire_id", params.ids);
      check(error);
      return { data: (data || []).map(record) };
    },
    async getManyReference(resource, params): Promise<any> {
      if (resource !== resourceName) return base.getManyReference(resource, params);
      throw new Error("Lecture par référence non prise en charge pour la programmation Freestyle.");
    },
    async create(resource, params): Promise<any> {
      if (resource !== resourceName) return base.create(resource, params);
      const validation = await supabase.rpc('questionnaire_structure_is_7x5', { p_questionnaire_id: params.data.questionnaire_id });
      check(validation.error);
      if (validation.data !== true) throw new Error('Structure incomplète : programmation Freestyle refusée (7 × 5 requis).');
      const { data, error } = await supabase.from(resourceName).insert({
        questionnaire_id: params.data.questionnaire_id, sort_order: params.data.sort_order ?? 0,
      }).select(columns).single();
      check(error);
      return { data: record(data) };
    },
    async update(resource, params): Promise<any> {
      if (resource !== resourceName) return base.update(resource, params);
      if (params.data.replacement_questionnaire_id) {
        const { data, error } = await supabase.rpc('replace_freestyle_questionnaire', {
          p_old_id: params.id, p_new_id: params.data.replacement_questionnaire_id,
        });
        check(error);
        // React Admin expects the previous identity for this mutation response;
        // redirect to the refreshed list displays the new persisted identity.
        return { data: { ...record(Array.isArray(data) ? data[0] : data), id: params.id } };
      }
      const { data, error } = await supabase.from(resourceName).update({ sort_order: params.data.sort_order })
        .eq("questionnaire_id", params.id).select(columns).single();
      check(error);
      return { data: record(data) };
    },
    async delete(resource, params): Promise<any> {
      if (resource !== resourceName) return base.delete(resource, params);
      const { data, error } = await supabase.from(resourceName).delete().eq("questionnaire_id", params.id).select(columns).single();
      check(error);
      return { data: record(data) };
    },
    async updateMany(resource, params) {
      if (resource !== resourceName) return base.updateMany(resource, params);
      throw new Error("Modification groupée non prise en charge pour Freestyle.");
    },
    async deleteMany(resource, params) {
      if (resource !== resourceName) return base.deleteMany(resource, params);
      throw new Error("Retrait groupé non pris en charge pour Freestyle.");
    },
  };
}
