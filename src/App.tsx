// src/App.tsx
import * as React from "react";
import {
  Admin,
  Resource,
  List,
  Datagrid,
  TextField,
  Edit,
  SimpleForm,
  TextInput,
  Create,
  NumberInput,
  ReferenceInput,
  SelectInput,
  ReferenceField,
  BooleanInput,
  FunctionField,
  BooleanField,
  CustomRoutes,
  TopToolbar,
  Button,
  useRecordContext,
} from "react-admin";
import { Route, useNavigate } from "react-router-dom";
import { useWatch, useFormContext } from "react-hook-form";
import dataProvider from "./dataProvider";
import { authProvider } from "./authProvider";
import LoginPage from "./LoginPage";
import WifiUpdate from "./pages/WifiUpdate";
import PlaceClaimRequestsList from "./pages/PlaceClaimRequestsList";

// ✅ Categories resource (déjà dans ton projet)
import { CategoriesList } from "./resources/categories/CategoriesList";
import { CategoriesEdit } from "./resources/categories/CategoriesEdit";
import { CategoriesCreate } from "./resources/categories/CategoriesCreate";

/* --------- Utils --------- */
const CopyToken = ({ record }: any) => {
  if (!record?.token) return null;
  return (
    <button
      onClick={() => navigator.clipboard.writeText(record.token)}
      style={{ padding: 6, borderRadius: 6, border: "1px solid #ddd", cursor: "pointer" }}
      title="Copier le token"
    >
      Copier
    </button>
  );
};

/* ========= App Config (NEW) ========= */
const AppConfigList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="key" label="Clé" />
      <FunctionField
        label="Valeur"
        render={(r: any) => <code>{JSON.stringify(r?.value ?? {}, null, 0)}</code>}
      />
    </Datagrid>
  </List>
);

const AppConfigEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="key" label="Clé" disabled />
      <TextInput
        source="value"
        label='JSON (ex: { "device_id": "..." })'
        multiline
        fullWidth
        format={(v: any) => JSON.stringify(v ?? {}, null, 2)}
        parse={(v: string) => {
          try {
            return JSON.parse(v);
          } catch {
            return {};
          }
        }}
      />
    </SimpleForm>
  </Edit>
);

/* ========= Mood ========= */
const MoodList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="created_at" label="Date" />
      <TextField source="color" />
      <TextField source="r" />
      <TextField source="g" />
      <TextField source="b" />
      <TextField source="mask" />
      <ReferenceField source="spot_id" reference="spots" label="Spot">
        <TextField source="name" />
      </ReferenceField>
    </Datagrid>
  </List>
);

const MoodEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="color" />
      <NumberInput source="r" />
      <NumberInput source="g" />
      <NumberInput source="b" />
      <TextInput source="mask" />
      <ReferenceInput source="spot_id" reference="spots" label="Spot">
        <SelectInput optionText="name" />
      </ReferenceInput>
    </SimpleForm>
  </Edit>
);

const MoodCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="color" />
      <NumberInput source="r" />
      <NumberInput source="g" />
      <NumberInput source="b" />
      <TextInput source="mask" />
      <ReferenceInput source="spot_id" reference="spots" label="Spot">
        <SelectInput optionText="name" />
      </ReferenceInput>
    </SimpleForm>
  </Create>
);

/* ========= Questionnaires ========= */
/**
 * ✅ Filtre : Catégorie
 * (fonctionne si questionnaires.category_id existe en base)
 */
const questionnaireFilters = [
  <ReferenceInput
    key="category"
    source="category_id"
    reference="categories"
    alwaysOn
    perPage={1000}
    label="Catégorie"
  >
    <SelectInput optionText="label" />
  </ReferenceInput>,
];

const QuestionnaireList = () => (
  <List filters={questionnaireFilters}>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="title" label="Titre" />

      <ReferenceField source="category_id" reference="categories" label="Catégorie" link={false}>
        <TextField source="label" />
      </ReferenceField>

      <TextField source="scope" label="Scope" />
      <TextField source="created_at" label="Créé le" />
    </Datagrid>
  </List>
);

const QuestionnaireEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="title" fullWidth />

      <ReferenceInput source="category_id" reference="categories" perPage={1000} label="Catégorie">
        <SelectInput optionText="label" optionValue="id" fullWidth />
      </ReferenceInput>

      <TextInput source="scope" fullWidth />
    </SimpleForm>
  </Edit>
);

const QuestionnaireCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="title" required fullWidth />

      <ReferenceInput source="category_id" reference="categories" perPage={1000} label="Catégorie">
        <SelectInput optionText="label" optionValue="id" fullWidth />
      </ReferenceInput>

      <TextInput source="scope" fullWidth defaultValue="global" />
    </SimpleForm>
  </Create>
);

/* ========= Questions ========= */
const QuestionList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="text" />
      <TextField source="order_index" />
      <ReferenceField source="questionnaire_id" reference="questionnaires">
        <TextField source="title" />
      </ReferenceField>
    </Datagrid>
  </List>
);

const QuestionEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="text" />
      <NumberInput source="order_index" />
      <ReferenceInput source="questionnaire_id" reference="questionnaires">
        <SelectInput optionText="title" />
      </ReferenceInput>
    </SimpleForm>
  </Edit>
);

const QuestionCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="text" required />
      <NumberInput source="order_index" />
      <ReferenceInput source="questionnaire_id" reference="questionnaires">
        <SelectInput optionText="title" />
      </ReferenceInput>
    </SimpleForm>
  </Create>
);

/* ========= Choices ========= */
/**
 * Filtre principal : Questionnaire (affiche title, filtre questionnaire_id)
 * => nécessite choices.questionnaire_id (uuid) en base
 */
const choiceFilters = [
  <ReferenceInput key="questionnaire" source="questionnaire_id" reference="questionnaires" alwaysOn>
    <SelectInput optionText="title" />
  </ReferenceInput>,
];

// ✅ composant utilitaire : question filtrée selon questionnaire + reset automatique
const FilteredQuestionInput: React.FC = () => {
  const questionnaireId = useWatch({ name: "questionnaire_id" });
  const { setValue } = useFormContext();

  React.useEffect(() => {
    setValue("question_id", null, { shouldDirty: true, shouldTouch: true });
  }, [questionnaireId, setValue]);

  return (
    <ReferenceInput
      source="question_id"
      reference="questions"
      label="Question"
      filter={questionnaireId ? { questionnaire_id: questionnaireId } : {}}
      disabled={!questionnaireId}
    >
      <SelectInput optionText="text" />
    </ReferenceInput>
  );
};

const ChoiceList = () => (
  <List filters={choiceFilters}>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="text" />
      <TextField source="value" />

      <ReferenceField source="questionnaire_id" reference="questionnaires" label="Questionnaire">
        <TextField source="title" />
      </ReferenceField>

      <ReferenceField source="question_id" reference="questions" label="Question">
        <TextField source="text" />
      </ReferenceField>
    </Datagrid>
  </List>
);

const ChoiceEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="text" />
      <NumberInput source="value" />

      <ReferenceInput source="questionnaire_id" reference="questionnaires" label="Questionnaire">
        <SelectInput optionText="title" />
      </ReferenceInput>

      <FilteredQuestionInput />
    </SimpleForm>
  </Edit>
);

const ChoiceCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="text" required />
      <NumberInput source="value" />

      <ReferenceInput source="questionnaire_id" reference="questionnaires" label="Questionnaire">
        <SelectInput optionText="title" />
      </ReferenceInput>

      <FilteredQuestionInput />
    </SimpleForm>
  </Create>
);

/* ========= Spots ========= */
const SpotList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="name" />
      <TextField source="lat" />
      <TextField source="lng" />
      <ReferenceField source="questionnaire_id" reference="questionnaires">
        <TextField source="title" />
      </ReferenceField>
    </Datagrid>
  </List>
);

const SpotEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="name" />
      <NumberInput source="lat" />
      <NumberInput source="lng" />
      <ReferenceInput source="questionnaire_id" reference="questionnaires">
        <SelectInput optionText="title" />
      </ReferenceInput>
    </SimpleForm>
  </Edit>
);

const SpotCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="name" required />
      <NumberInput source="lat" />
      <NumberInput source="lng" />
      <ReferenceInput source="questionnaire_id" reference="questionnaires">
        <SelectInput optionText="title" />
      </ReferenceInput>
    </SimpleForm>
  </Create>
);

/* ========= Devices (ESP) ========= */
const WifiButton: React.FC = () => {
  const record = useRecordContext<any>();
  const navigate = useNavigate();
  if (!record) return null;
  return <Button label="Changer le Wi-Fi" onClick={() => navigate(`/devices/${record.id}/wifi`)} />;
};

const DeviceEditActions: React.FC = () => (
  <TopToolbar>
    <WifiButton />
  </TopToolbar>
);

const DeviceList = () => (
  <List>
    <Datagrid rowClick="edit">
      <TextField source="id" />
      <TextField source="name" label="Nom" />
      <TextField source="mac" />
      <TextField source="token" />
      <FunctionField label=" " render={(record: any) => <CopyToken record={record} />} />
      <ReferenceField source="spot_id" reference="spots" label="Spot">
        <TextField source="name" />
      </ReferenceField>
      <BooleanField source="is_active" label="Actif" />
    </Datagrid>
  </List>
);

const DeviceEdit = () => (
  <Edit actions={<DeviceEditActions />}>
    <SimpleForm>
      <TextInput source="name" label="Nom" />
      <TextInput source="mac" />
      <TextInput source="token" label="Token" disabled />
      <ReferenceInput source="spot_id" reference="spots" label="Assigné au spot">
        <SelectInput optionText="name" />
      </ReferenceInput>
      <BooleanInput source="is_active" />
      <TextInput source="ip" />
    </SimpleForm>
  </Edit>
);

const DeviceCreate = () => (
  <Create>
    <SimpleForm>
      <TextInput source="name" label="Nom" required />
      <TextInput source="mac" />
      <ReferenceInput source="spot_id" reference="spots" label="Assigné au spot">
        <SelectInput optionText="name" />
      </ReferenceInput>
    </SimpleForm>
  </Create>
);

/* ========= App ========= */
export default function App() {
  return (
    <Admin dataProvider={dataProvider} authProvider={authProvider} loginPage={LoginPage}>
      <Resource name="app_config" list={AppConfigList} edit={AppConfigEdit} options={{ label: "Config" }} />

      <Resource
        name="categories"
        list={CategoriesList}
        edit={CategoriesEdit}
        create={CategoriesCreate}
        options={{ label: "Catégories" }}
      />

      <Resource
        name="questionnaires"
        list={QuestionnaireList}
        edit={QuestionnaireEdit}
        create={QuestionnaireCreate}
        options={{ label: "Questionnaires" }}
      />
      <Resource
        name="questions"
        list={QuestionList}
        edit={QuestionEdit}
        create={QuestionCreate}
        options={{ label: "Questions" }}
      />
      <Resource
        name="choices"
        list={ChoiceList}
        edit={ChoiceEdit}
        create={ChoiceCreate}
        options={{ label: "Choix" }}
      />
      <Resource name="spots" list={SpotList} edit={SpotEdit} create={SpotCreate} options={{ label: "Spots" }} />
      <Resource name="devices" list={DeviceList} edit={DeviceEdit} create={DeviceCreate} options={{ label: "Devices" }} />
      <Resource name="mood" list={MoodList} edit={MoodEdit} create={MoodCreate} options={{ label: "Mood" }} />
      <Resource
        name="place_claim_requests"
        list={PlaceClaimRequestsList}
        options={{ label: "Revendications lieux" }}
      />

      <CustomRoutes>
        <Route path="/wifi" element={<WifiUpdate />} />
        <Route path="/devices/:id/wifi" element={<WifiUpdate />} />
      </CustomRoutes>
    </Admin>
  );
}