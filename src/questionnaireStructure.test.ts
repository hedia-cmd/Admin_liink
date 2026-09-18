import { EditorialQuestion, validateQuestionnaireStructure } from './questionnaireStructure';
const fixture = (): EditorialQuestion[] => Array.from({ length: 7 }, (_, i) => ({
  id: `q${i}`, text: `Texte ${i}`, order_index: i + 1,
  choices: Array.from({ length: 5 }, (_, j) => ({ id: `c${i}-${j}`, text: `Réponse ${j}`, value: j, order_index: j + 1 })),
}));
test('strict 7 × 5 passes', () => expect(validateQuestionnaireStructure(fixture())).toEqual([]));
test.each(['six', 'four', 'duplicateValue', 'duplicateChoiceOrder', 'duplicateQuestionOrder', 'null', 'outOfRange'])('%s prevents publication with actionable diagnostics', kind => {
  const q = fixture();
  if (kind === 'six') q.pop();
  if (kind === 'four') q[2].choices.pop();
  if (kind === 'duplicateValue') q[0].choices[1].value = 0;
  if (kind === 'duplicateChoiceOrder') q[4].choices[1].order_index = 1;
  if (kind === 'duplicateQuestionOrder') q[1].order_index = 1;
  if (kind === 'null') q[0].choices[1].value = null;
  if (kind === 'outOfRange') q[0].choices[1].value = 32;
  const errors = validateQuestionnaireStructure(q);
  expect(errors.length).toBeGreaterThan(0);
  if (kind === 'four') expect(errors).toContain('Question 3 « Texte 2 » : 4 réponses sur 5.');
  if (kind === 'duplicateChoiceOrder') expect(errors.some(e => e.includes('Question 5') && e.includes('ordre'))).toBe(true);
});
