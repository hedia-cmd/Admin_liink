export const mainQuestionnaireScoreContract = "mood_poles_v1";

export type MainQuestionnaireOption = {
  questionnaire_id: string;
  title: string | null;
  question_count: number;
  min_choice_count: number | null;
  max_choice_count: number | null;
  observed_values: number[];
  is_compatible: boolean;
};

export function normalizeMainQuestionnaireOption(
  value: Record<string, unknown>,
): MainQuestionnaireOption {
  const observedValues = Array.isArray(value.observed_values)
    ? value.observed_values
        .map((item) => Number(item))
        .filter((item) => Number.isInteger(item))
    : [];
  return {
    questionnaire_id: String(value.questionnaire_id ?? ""),
    title: value.title == null ? null : String(value.title),
    question_count: Number(value.question_count ?? 0),
    min_choice_count:
      value.min_choice_count == null ? null : Number(value.min_choice_count),
    max_choice_count:
      value.max_choice_count == null ? null : Number(value.max_choice_count),
    observed_values: observedValues,
    is_compatible: value.is_compatible === true,
  };
}

export function mainQuestionnaireOptionLabel(
  option: MainQuestionnaireOption,
): string {
  const title = option.title?.trim() || "Questionnaire sans titre";
  const status = option.is_compatible ? "compatible 7 × 5" : "incompatible";
  return `${title} — ${status} — ${option.questionnaire_id}`;
}
