jest.mock('./supabaseClient', () => ({ __esModule: true, default: { rpc: jest.fn(async () => ({ data: true })) } }));
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Admin, Resource, memoryStore, testDataProvider } from 'react-admin';
import { MemoryRouter } from 'react-router-dom';
import { FreestyleCreate, FreestyleEdit, FreestyleList } from './resources/freestyle/Freestyle';

const questionnaire = { id: 'q1', title: 'Godard', category_id: 'cat1', status: 'active', content_version: 2 };
const entry = { id: 'q1', questionnaire_id: 'q1', sort_order: 10 };
function setup(path: string) {
  const getList = jest.fn(async (resource: string, _params: any): Promise<any> => ({
    data: resource === 'questionnaire_freestyle' ? [entry] : [questionnaire], total: 1,
  }));
  const create = jest.fn(async (_resource, params) => ({ data: { ...params.data, id: params.data.questionnaire_id } }));
  const update = jest.fn(async (_resource, params) => ({ data: { ...entry, ...params.data } }));
  const remove = jest.fn(async (): Promise<any> => ({ data: entry }));
  const provider = testDataProvider({ getList, create, update, delete: remove,
    getOne: async (resource): Promise<any> => ({ data: resource === 'questionnaire_freestyle' ? entry : questionnaire }),
    getMany: async (resource): Promise<any> => ({ data: resource === 'categories' ? [{ id: 'cat1', label: 'Cinéma' }] : [questionnaire] }),
  });
  render(<MemoryRouter initialEntries={[path]}><Admin dataProvider={provider} store={memoryStore()}>
    <Resource name="questionnaire_freestyle" list={FreestyleList} create={FreestyleCreate} edit={FreestyleEdit} options={{ label: 'Freestyle' }} />
    <Resource name="questionnaires" /><Resource name="categories" />
  </Admin></MemoryRouter>);
  return { getList, create, update, remove };
}

test('programming list requests ascending order and displays original title and category', async () => {
  const { getList } = setup('/questionnaire_freestyle');
  expect(await screen.findByText('Godard')).toBeInTheDocument();
  expect(await screen.findByText('Cinéma')).toBeInTheDocument();
  expect(getList).toHaveBeenCalledWith('questionnaire_freestyle', expect.objectContaining({ sort: { field: 'sort_order', order: 'ASC' } }));
});

test('admin adds an existing questionnaire to the independent schedule', async () => {
  const { create } = setup('/questionnaire_freestyle/create');
  const input = await screen.findByRole('combobox', { name: /Questionnaire existant/ });
  userEvent.click(input);
  userEvent.click(await screen.findByRole('option', { name: /Godard/ }));
  fireEvent.change(screen.getByLabelText('Ordre'), { target: { value: '30' } });
  userEvent.click(screen.getByRole('button', { name: 'Ajouter à Freestyle' }));
  await waitFor(() => expect(create).toHaveBeenCalledWith('questionnaire_freestyle', expect.objectContaining({ data: { questionnaire_id: 'q1', sort_order: 30 } })));
});

test('admin reorders a schedule entry without editing questionnaire fields', async () => {
  const { update } = setup('/questionnaire_freestyle/q1');
  const input = await screen.findByLabelText('Ordre');
  expect(screen.queryByLabelText('Titre')).not.toBeInTheDocument();
  fireEvent.change(input, { target: { value: '20' } });
  userEvent.click(screen.getByRole('button', { name: /save/i }));
  await waitFor(() => expect(update).toHaveBeenCalledWith('questionnaire_freestyle', expect.objectContaining({ id: 'q1', data: { ...entry, sort_order: 20 } })));
});

test('admin removes only the schedule entry', async () => {
  const { remove } = setup('/questionnaire_freestyle');
  userEvent.click(await screen.findByRole('button', { name: 'Retirer de Freestyle' }));
  userEvent.click(await screen.findByRole('button', { name: /confirm/i }));
  await waitFor(() => expect(remove).toHaveBeenCalledWith('questionnaire_freestyle', expect.objectContaining({ id: 'q1' })));
});
