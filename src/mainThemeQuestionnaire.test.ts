import {
  mainQuestionnaireOptionLabel,
  normalizeMainQuestionnaireOption,
} from "./mainThemeQuestionnaire";

test("normalizes the compatibility payload returned by Supabase", () => {
  const option = normalizeMainQuestionnaireOption({
    questionnaire_id: "questionnaire-id",
    title: "Mood — Boire & manger",
    question_count: "7",
    min_choice_count: "5",
    max_choice_count: 5,
    observed_values: [0, 1, 2, 3, 4],
    is_compatible: true,
  });

  expect(option.question_count).toBe(7);
  expect(option.min_choice_count).toBe(5);
  expect(option.max_choice_count).toBe(5);
  expect(option.observed_values).toEqual([0, 1, 2, 3, 4]);
  expect(option.is_compatible).toBe(true);
  expect(mainQuestionnaireOptionLabel(option)).toContain("compatible 7 × 5");
});

test("keeps an incompatible questionnaire visible and clearly labelled", () => {
  const option = normalizeMainQuestionnaireOption({
    questionnaire_id: "historical-questionnaire",
    title: "Questionnaire historique",
    question_count: 4,
    min_choice_count: 2,
    max_choice_count: 6,
    observed_values: [0, 1, 2],
    is_compatible: false,
  });

  expect(option.is_compatible).toBe(false);
  expect(mainQuestionnaireOptionLabel(option)).toContain("incompatible");
  expect(mainQuestionnaireOptionLabel(option)).toContain(
    "historical-questionnaire",
  );
});
