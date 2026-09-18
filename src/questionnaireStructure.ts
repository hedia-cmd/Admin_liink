export type EditorialChoice = { id: string; text: string; value: number | null; order_index: number | null };
export type EditorialQuestion = { id: string; text: string; order_index: number | null; choices: EditorialChoice[] };

const exact = (values: (number | null)[], start: number, count: number) =>
  values.length === count && new Set(values).size === count &&
  values.every(value => typeof value === 'number' && Number.isInteger(value) && value >= start && value < start + count);

export function validateQuestionnaireStructure(questions: EditorialQuestion[]): string[] {
  const errors: string[] = [];
  if (questions.length !== 7) errors.push(`${questions.length} questions sur 7.`);
  if (!exact(questions.map(q => q.order_index), 1, 7)) {
    errors.push('Ordre des questions invalide : utiliser une fois chaque position de 1 à 7, sans valeur vide.');
  }
  questions.forEach((q, index) => {
    const label = `Question ${index + 1} « ${q.text} »`;
    if (q.choices.length !== 5) errors.push(`${label} : ${q.choices.length} réponses sur 5.`);
    if (!exact(q.choices.map(c => c.value), 0, 5)) errors.push(`${label} : valeurs des réponses invalides (0 à 4, sans doublon ni valeur vide).`);
    if (!exact(q.choices.map(c => c.order_index), 1, 5)) errors.push(`${label} : ordre des réponses invalide (1 à 5, sans doublon ni valeur vide).`);
  });
  return errors;
}

export const editorialInteger = (min: number, max: number) => (value: unknown) =>
  typeof value === 'number' && Number.isInteger(value) && value >= min && value <= max
    ? undefined : `Saisissez un entier de ${min} à ${max}.`;
