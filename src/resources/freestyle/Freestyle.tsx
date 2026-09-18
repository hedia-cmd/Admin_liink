import * as React from 'react';
import { useWatch } from 'react-hook-form';
import supabase from '../../supabaseClient';
import {
  AutocompleteInput, Create, Datagrid, DeleteButton, Edit, List, NumberField,
  NumberInput, ReferenceField, ReferenceInput, SaveButton, SimpleForm,
  TextField, Toolbar, required, useRecordContext,
} from "react-admin";
import { Typography } from "@mui/material";

export const validateSortOrder = (value: unknown) =>
  value !== null && value !== undefined && value !== "" &&
  Number.isInteger(Number(value)) && Number(value) >= -2147483648 && Number(value) <= 2147483647
    ? undefined : "Saisissez un entier valide.";

const OrderInput = () => {
  const replacement = useWatch({ name: "replacement_questionnaire_id" });
  return (
  <NumberInput source="sort_order" label="Ordre" defaultValue={0} step={1} disabled={!!replacement}
    validate={validateSortOrder} helperText="Les plus petits nombres apparaissent en premier." />
);
};

const OriginCategory = ({ label }: { label?: string; sortable?: boolean }) => (
  <ReferenceField source="questionnaire_id" reference="questionnaires" link={false} label={label}>
    <ReferenceField source="category_id" reference="categories" link={false} emptyText="Sans catégorie">
      <TextField source="label" />
    </ReferenceField>
  </ReferenceField>
);

const StructureStatus = ({ label }: { label?: string }) => {
  const record = useRecordContext<any>();
  const [status, setStatus] = React.useState('Validation…');
  React.useEffect(() => {
    let current = true;
    setStatus('Validation…');
    Promise.resolve(supabase.rpc('questionnaire_structure_is_7x5', { p_questionnaire_id: record.questionnaire_id }))
      .then(({ data, error }) => { if (current) setStatus(error ? 'Validation indisponible' : data === true ? 'Conforme 7 × 5' : 'Non conforme — à corriger dans une nouvelle version'); })
      .catch(() => { if (current) setStatus('Validation indisponible'); });
    return () => { current = false; };
  }, [record.questionnaire_id]);
  return <Typography aria-label={label}>{status}</Typography>;
};

export const FreestyleList = () => (
  <List title="Freestyle" sort={{ field: "sort_order", order: "ASC" }}>
    <Typography sx={{ p: 2 }}>
      Programmation éditoriale : privilégiez 6 à 8 questionnaires. Retirer une entrée conserve le questionnaire et ses réponses.
    </Typography>
    <Datagrid rowClick="edit" bulkActionButtons={false}>
      <NumberField source="sort_order" label="Ordre" />
      <ReferenceField source="questionnaire_id" reference="questionnaires" label="Titre" link={false} sortBy="questionnaire_id">
        <TextField source="title" />
      </ReferenceField>
      <OriginCategory label="Catégorie d’origine" sortable={false} />
      <StructureStatus label="Structure" />
      <DeleteButton label="Retirer de Freestyle" mutationMode="pessimistic" redirect={false} />
    </Datagrid>
  </List>
);

export const FreestyleCreate = () => (
  <Create title="Ajouter à Freestyle" redirect="list">
    <SimpleForm toolbar={<Toolbar><SaveButton label="Ajouter à Freestyle" /></Toolbar>}>
      <ReferenceInput source="questionnaire_id" reference="freestyle_questionnaire_options" perPage={25}>
        <AutocompleteInput label="Questionnaire existant" validate={required()}
          optionText={(record: any) => `${record.title || "Sans titre"} — ${record.id}`}
          filterToQuery={(search: string) => ({ title: `%${search}%` })} fullWidth />
      </ReferenceInput>
      <Typography>Seules les versions actives conformes 7 × 5 sont proposées. Corriger les autres depuis Questionnaires.</Typography>
      <OrderInput />
    </SimpleForm>
  </Create>
);

export const FreestyleEdit = () => (
  <Edit title="Ordre Freestyle" mutationMode="pessimistic" redirect="list">
    <SimpleForm toolbar={<Toolbar><SaveButton /><DeleteButton label="Retirer de Freestyle" mutationMode="pessimistic" /></Toolbar>}>
      <ReferenceField source="questionnaire_id" reference="questionnaires" label="Titre" link={false}>
        <TextField source="title" />
      </ReferenceField>
      <OriginCategory label="Catégorie d’origine" />
      <StructureStatus label="Structure" />
      <ReferenceInput source="replacement_questionnaire_id" reference="freestyle_questionnaire_options" filter={{ active_only: true }}>
        <AutocompleteInput label="Remplacer par une version active conforme" optionText="title"
          filterToQuery={(search: string) => ({ title: search })}
          helperText="Facultatif. Le remplacement conserve exactement l’ordre actuel." fullWidth />
      </ReferenceInput>
      <OrderInput />
    </SimpleForm>
  </Edit>
);
