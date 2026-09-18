import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { AdminContext, RecordContextProvider, testDataProvider } from 'react-admin';
import { MemoryRouter } from 'react-router-dom';
import { StructurePanel, DraftOnly } from './StructurePanel';
import { readStructure, activateQuestionnaire } from '../../questionnaireAdmin';
jest.mock('../../questionnaireAdmin', () => ({ readStructure: jest.fn(), activateQuestionnaire: jest.fn(), deactivateQuestionnaire: jest.fn(), duplicateQuestionnaire: jest.fn() }));
const mount = (status: string, child: React.ReactNode, theme_id: string | null = 'theme') => render(
  <MemoryRouter><AdminContext dataProvider={testDataProvider({ getOne: async (): Promise<any> => ({ data: { id: 'q', status } }) })}>
    <RecordContextProvider value={{ id: 'q', questionnaire_id: 'q', status, theme_id, category_id: 'cat', content_version: 1 }}>{child}</RecordContextProvider>
  </AdminContext></MemoryRouter>
);
beforeEach(() => { jest.clearAllMocks(); (readStructure as jest.Mock).mockResolvedValue({ questions: [], valid: false }); });
test('retired page offers a new draft and no inline edits or activation', async () => {
  mount('retired', <StructurePanel />);
  expect(await screen.findByText(/Structure incomplète/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Créer une nouvelle version brouillon' })).toBeEnabled();
  expect(screen.queryByRole('button', { name: 'Activer la version' })).not.toBeInTheDocument();
  expect(screen.queryByText('Ajouter une question')).not.toBeInTheDocument();
});
test('invalid draft cannot be activated', async () => {
  mount('draft', <StructurePanel />);
  await screen.findByText(/Structure incomplète/);
  expect(screen.getByRole('button', { name: 'Activer la version' })).toBeDisabled();
});
test('unthemed retired version allows a new editorial draft', async () => {
  mount('retired', <StructurePanel />, null);
  await screen.findByText(/Structure incomplète/);
  expect(screen.getByText(/Questionnaire éditorial — sans thématique/)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Créer une nouvelle version brouillon' })).toBeEnabled();
});
test('retired child editor never exposes edit controls', async () => {
  mount('retired', <DraftOnly><button>Écrire</button></DraftOnly>);
  await waitFor(() => expect(screen.getByText(/Cette version est immuable/)).toBeInTheDocument());
  expect(screen.queryByText('Écrire')).not.toBeInTheDocument();
});

test.each([null, 'theme'])('valid draft activation routes by theme %s', async theme => {
  (readStructure as jest.Mock).mockResolvedValue({ valid: true, questions: Array.from({ length: 7 }, (_, i) => ({
    id: `q${i}`, text: `Question ${i}`, order_index: i + 1,
    choices: Array.from({ length: 5 }, (_, j) => ({ id: `c${i}-${j}`, text: `Choix ${j}`, value: j, order_index: j + 1 })),
  })) });
  const confirm = jest.spyOn(window, 'confirm').mockReturnValue(true);
  try {
    mount('draft', <StructurePanel />, theme);
    await screen.findByText(/Structure valide/);
    const button = screen.getByRole('button', { name: 'Activer la version' });
    expect(button).toBeEnabled();
    fireEvent.click(button);
    await waitFor(() => expect(activateQuestionnaire).toHaveBeenCalledWith('q', theme ? 'main' : 'editorial'));
    expect(confirm).toHaveBeenCalledWith(expect.stringContaining(theme ? 'thématique' : 'éditoriale'));
  } finally { confirm.mockRestore(); }
});
