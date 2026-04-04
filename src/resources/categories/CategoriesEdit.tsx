import { Edit, SimpleForm, TextInput, BooleanInput, NumberInput } from "react-admin";

export const CategoriesEdit = () => (
  <Edit>
    <SimpleForm>
      <TextInput source="label" fullWidth />
      <TextInput source="slug" helperText="ex: pop, poetique, politique" fullWidth />
      <TextInput source="description" multiline fullWidth />
      <NumberInput source="sort_order" />
      <BooleanInput source="is_active" defaultValue />
    </SimpleForm>
  </Edit>
);
